// src/app/api/public-search/records/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to convert any standard time string (HH:MM or HH:MM:SS) to absolute minutes
function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(":")) return 0;
  // Split by ':' and clean up any whitespace or hidden characters
  const parts = timeStr.trim().split(":").map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffCode = searchParams.get("staffCode");

    if (!staffCode) {
      return NextResponse.json({ error: "Missing staffCode parameter" }, { status: 400 });
    }

    // 1️⃣ Fetch raw logs from database [cite: 24, 26]
    const rawLogs = await prisma.attendanceRecord.findMany({
      where: { staffCode: staffCode }
    });

    if (!rawLogs || rawLogs.length === 0) {
      return NextResponse.json({ success: true, records: [] });
    }

    // 2️⃣ Chronological Sort in-memory [cite: 27]
    const logs = [...rawLogs].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

    // 3️⃣ Isolate unique log dates [cite: 27]
    const uniqueDates = Array.from(new Set(logs.map(log => log.date)));

    const processedRecords = uniqueDates.map(dateStr => {
      const dayLogs = logs.filter(log => log.date === dateStr);
      
      // Normalize weekday capitalization to prevent string template mismatch [cite: 27]
      const rawDay = dayLogs[0]?.weekDay || "Monday";
      const weekDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();

      // Filter punch entries securely [cite: 27]
      const ins = dayLogs
        .filter(l => l.swipeType && l.swipeType.toLowerCase().includes("in"))
        .sort((a, b) => a.time.localeCompare(b.time));

      const outs = dayLogs
        .filter(l => l.swipeType && l.swipeType.toLowerCase().includes("out"))
        .sort((a, b) => a.time.localeCompare(b.time));

      const rawCheckIn = ins.length > 0 ? ins[0].time : "—";
      const rawCheckOut = outs.length > 0 ? outs[outs.length - 1].time : "—";

      let totalShiftHours = 0;
      let overtimeHours = 0;
      let status = "PRESENT";

      if (rawCheckIn !== "—" && rawCheckOut !== "—") {
        // Calculate minutes safely using the helper function
        const inMinutes = timeToMinutes(rawCheckIn);
        const outMinutes = timeToMinutes(rawCheckOut);
        
        const diffMinutes = outMinutes - inMinutes;
        
        if (diffMinutes > 0) {
          totalShiftHours = parseFloat((diffMinutes / 60).toFixed(2));
          
          // Late status check (07:30 = 450 minutes)
          if (inMinutes > 450) {
            status = "LATE";
          }

          // Calculate standard caps: 5.5 hours (330 mins) for weekends, 8.5 hours (510 mins) for weekdays [cite: 27]
          const standardLimitMinutes = (weekDay === "Saturday" || weekDay === "Sunday") ? 330 : 510;
          
          if (diffMinutes > standardLimitMinutes) {
            overtimeHours = parseFloat(((diffMinutes - standardLimitMinutes) / 60).toFixed(2));
          }
        }
      } else {
        status = "INCOMPLETE";
      }

      // Format clean HH:MM string outputs for your frontend UI
      const formatDisplayTime = (rawTime: string) => {
        if (rawTime === "—") return "—";
        const parts = rawTime.trim().split(":");
        return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
      };

      return {
        date: dateStr,
        weekDay,
        checkIn: formatDisplayTime(rawCheckIn),
        checkOut: formatDisplayTime(rawCheckOut),
        totalShiftHours,
        overtimeHours,
        status
      };
    });

    return NextResponse.json({ success: true, records: processedRecords });
  } catch (error: any) {
    console.error("🔴 [SERVER DATA FAULT]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}