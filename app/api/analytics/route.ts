import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// Local AttendanceLog type to avoid relying on @prisma/client exports
type AttendanceLog = {
  id?: string;
  staffCode: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  weekDay: string;
  swipeType: string; // "Check In" | "Check Out"
  attendanceCheckPoint?: string | null;
};

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { fullName: "asc" }
    });

    const logs = await prisma.attendanceRecord.findMany({
      orderBy: { date: "asc" }
    });

    // 1. Process Day and Type Volume Distribution Metrics
    const weekdayTrends: Record<string, number> = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    };
    
    let totalCheckIns = 0;
    let totalCheckOuts = 0;

    logs.forEach((log: AttendanceLog) => {
      if (weekdayTrends[log.weekDay] !== undefined) weekdayTrends[log.weekDay]++;
      if (log.swipeType === "Check In") totalCheckIns++;
      if (log.swipeType === "Check Out") totalCheckOuts++;
    });

    // 2. Structuring Sequence: Pair sequential Swipes into Daily Shift Records
    const shiftsByEmployeeAndDate: Record<string, Record<string, any>> = {};

    logs.forEach((log: AttendanceLog) => {
      const code = log.staffCode;
      const dateKey = log.date;

      if (!shiftsByEmployeeAndDate[code]) shiftsByEmployeeAndDate[code] = {};
      if (!shiftsByEmployeeAndDate[code][dateKey]) {
        shiftsByEmployeeAndDate[code][dateKey] = {
          date: dateKey,
          weekDay: log.weekDay,
          checkIn: null,
          checkOut: null,
          checkpoint: log.attendanceCheckPoint
        };
      }

      if (log.swipeType === "Check In") shiftsByEmployeeAndDate[code][dateKey].checkIn = log.time;
      if (log.swipeType === "Check Out") shiftsByEmployeeAndDate[code][dateKey].checkOut = log.time;
    });

    // 3. Compute Complex Dynamic KPIs (Shift Durations, Overtime thresholds, Punctuality)
    const finalizedReports: Record<string, any[]> = {};
    
    Object.keys(shiftsByEmployeeAndDate).forEach(code => {
      finalizedReports[code] = [];
      Object.keys(shiftsByEmployeeAndDate[code]).forEach(dateKey => {
        const shift = shiftsByEmployeeAndDate[code][dateKey];
        
        let totalShiftHours = 0;
        let overtimeHours = 0;
        let status = "PRESENT";

        if (shift.checkIn && shift.checkOut) {
          const [inH, inM] = shift.checkIn.split(":").map(Number);
          const [outH, outM] = shift.checkOut.split(":").map(Number);
          
          const durationMinutes = (outH * 60 + outM) - (inH * 60 + inM);
          totalShiftHours = parseFloat((durationMinutes / 60).toFixed(1));

          // Calculate Overtime past an 8-hour shift
          if (totalShiftHours > 8) {
            overtimeHours = parseFloat((totalShiftHours - 8).toFixed(1));
          }

          // Rule: Flag LATE status if Checking In past 08:00 AM
          if (inH >= 8 && inM > 0) {
            status = "LATE";
          }
        } else {
          status = "ABSENT (INVALID PUNCHES)";
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
          { name: "Check In", count: totalCheckIns },
          { name: "Check Out", count: totalCheckOuts }
        ]
      },
      processedReports: finalizedReports
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}