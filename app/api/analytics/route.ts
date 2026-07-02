import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🚀 FIXED: Updated type schema to match real Prisma Date types
type AttendanceLog = {
  id: string;
  staffCode: string;
  date: Date;      // 👈 Changed from string to Date
  time: Date;      // 👈 Changed from string to Date
  weekDay: string;
  swipeType: string;
  is_manual_override: boolean | null;
  adjusted_by: string | null;
  change_reason: string | null;
  createdAt: Date;
  updated_at: Date;
};

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { fullName: "asc" }
    });

    // Explicitly casting the database result to our clean AttendanceLog interface array
    const logs = (await prisma.attendanceRecord.findMany({
      orderBy: { date: "asc" }
    })) as unknown as AttendanceLog[];

    // 1. Process Day and Type Volume Distribution Metrics
    const weekdayTrends: Record<string, number> = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    };
    
    let totalCheckIns = 0;
    let totalCheckOuts = 0;

    // This loop will now execute without any compilation or build barriers
    logs.forEach((log: AttendanceLog) => {
      if (weekdayTrends[log.weekDay] !== undefined) weekdayTrends[log.weekDay]++;
      if (log.swipeType === "Check In") totalCheckIns++;
      if (log.swipeType === "Check Out") totalCheckOuts++;
    });

    // 2. Build Structural User Timelines Mapped via Staff Code Matrix
    const trackingMap: Record<string, any[]> = {};
    employees.forEach(emp => {
      trackingMap[emp.staffCode] = [];
    });

    logs.forEach((log: AttendanceLog) => {
      // 🚀 FIXED: Convert Prisma's Date objects to 'YYYY-MM-DD' and 'HH:MM' string values for downstream code
      const dateString = log.date.toISOString().split("T")[0];
      const timeString = log.time.toISOString().split("T")[1].slice(0, 5);

      if (trackingMap[log.staffCode]) {
        trackingMap[log.staffCode].push({
          date: dateString,
          time: timeString,
          weekDay: log.weekDay,
          swipeType: log.swipeType
        });
      }
    });

    // 3. Assemble complete historical shift arrays
    const finalizedReports: Record<string, any[]> = {};
    
    Object.keys(trackingMap).forEach(code => {
      finalizedReports[code] = [];
      const historyArr = trackingMap[code];

      // Isolate records by unique dates
      const uniqueDates = Array.from(new Set(historyArr.map(h => h.date)));

      uniqueDates.forEach(dateStr => {
        const targetDayPunches = historyArr.filter(h => h.date === dateStr);
        
        const checkIns = targetDayPunches.filter(h => h.swipeType === "Check In").sort((a,b) => a.time.localeCompare(b.time));
        const checkOuts = targetDayPunches.filter(h => h.swipeType === "Check Out").sort((a,b) => b.time.localeCompare(a.time));

        const hasIn = checkIns.length > 0;
        const hasOut = checkOuts.length > 0;

        const shift = {
          date: dateStr,
          weekDay: targetDayPunches[0]?.weekDay || "Workday",
          checkIn: hasIn ? checkIns[0].time : "—",
          checkOut: hasOut ? checkOuts[0].time : "—",
          hoursWorked: 0,
          overtimeHours: 0,
          totalShiftHours: 0,
          status: "ABSENT"
        };

        let totalShiftHours = 0;
        let overtimeHours = 0;
        let status = "ON TIME";

        // CRITICAL UPDATE: Only calculate hours if BOTH clockIn and clockOut exist
        if (hasIn && hasOut) {
          const [inH, inM] = shift.checkIn.split(":").map(Number);
          const [outH, outM] = shift.checkOut.split(":").map(Number);
          
          const durationMinutes = (outH * 60 + outM) - (inH * 60 + inM);
          totalShiftHours = parseFloat((durationMinutes / 60).toFixed(1));

          // Calculate Overtime past an 8-hour shift
          if (totalShiftHours > 8) {
            overtimeHours = parseFloat((totalShiftHours - 8).toFixed(1));
          }

          // Rule: Flag LATE status if Checking In past 07:30 AM
          if (inH > 7 || (inH === 7 && inM > 30)) {
            status = "LATE";
          }
        } else if (hasIn || hasOut) {
          status = "MISSED A CLOCK PUNCH";
        } else {
          status = "ABSENT";
        }

        finalizedReports[code].push({
          ...shift,
          totalShiftHours: totalShiftHours > 0 ? totalShiftHours : 0,
          overtimeHours,
          status
        });
      });
    });

    return NextResponse.json({
      employees,
      logs,
      metrics: {
        totalEmployees: employees.length,
        totalPunches: logs.length,
        totalCheckIns,
        totalCheckOuts
      },
      charts: {
        trends: Object.keys(weekdayTrends).map(day => ({ day, volume: weekdayTrends[day] })),
        distribution: [
          { name: "Check In Volume", value: totalCheckIns },
          { name: "Check Out Volume", value: totalCheckOuts }
        ]
      },
      computedTimelines: finalizedReports
    }, { status: 200 });

  } catch (error: any) {
    console.error("[CRITICAL ANALYTICS FAULT]:", error);
    return NextResponse.json({ success: false, error: "Internal processing crash", details: error.message }, { status: 500 });
  }
}