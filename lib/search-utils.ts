// lib/search-utils.ts

export type DailyScheduleRow = {
  date: string;
  weekDay: string;
  clockIn: string;
  clockOut: string;
  regularHours: number;
  overtimeHours: number;
  totalShiftHours: number;
  status: "PRESENT" | "LATE" | "ABSENT (INVALID PUNCHES)";
};

export function processSwipesForEmployee(rawSwipes: any[], staffCode: string, dayFilter: string = "ALL") {
  // Filter logs specifically targeting the searched employee identity
  const employeeSwipes = rawSwipes.filter(s => s.staffCode === staffCode);
  if (employeeSwipes.length === 0) return [];

  const uniqueDates = Array.from(new Set(employeeSwipes.map(s => s.date))).sort((a, b) => b.localeCompare(a));
  const detailedSchedule: DailyScheduleRow[] = [];

  uniqueDates.forEach(dateStr => {
    const daySwipes = employeeSwipes.filter(s => s.date === dateStr);
    const weekDay = daySwipes[0]?.weekDay || "Unknown";

    // Application Layer Dropdown Filtering
    if (dayFilter !== "ALL" && weekDay.toLowerCase() !== dayFilter.toLowerCase()) return;

    const checkIns = daySwipes
      .filter(s => s.swipeType.toLowerCase().includes("in"))
      .sort((a, b) => a.time.localeCompare(b.time));
    const checkOuts = daySwipes
      .filter(s => s.swipeType.toLowerCase().includes("out"))
      .sort((a, b) => a.time.localeCompare(b.time));

    const clockIn = checkIns.length > 0 ? checkIns[0].time : "—";
    const clockOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].time : "—";

    let regularHours = 0;
    let overtimeHours = 0;
    let totalShiftHours = 0;
    let status: "PRESENT" | "LATE" | "ABSENT (INVALID PUNCHES)" = "PRESENT";

    // Complete Shift Boundary Check (Matches your frontend filter logic)
    if (clockIn !== "—" && clockOut !== "—") {
      const [inH, inM] = clockIn.split(":").map(Number);
      const [outH, outM] = clockOut.split(":").map(Number);
      const minutesDiff = (outH * 60 + outM) - (inH * 60 + inM);
      
      totalShiftHours = parseFloat((minutesDiff / 60).toFixed(2));
      if (totalShiftHours < 0) totalShiftHours = 0;

      if (clockIn > "07:30") status = "LATE";

      // Apply dynamic weekday vs weekend thresholds
      const isWeekend = weekDay === "Saturday" || weekDay === "Sunday";
      const dailyCap = isWeekend ? 5.5 : 8.5;

      if (totalShiftHours > dailyCap) {
        regularHours = dailyCap;
        overtimeHours = parseFloat((totalShiftHours - dailyCap).toFixed(2));
      } else {
        regularHours = totalShiftHours;
        overtimeHours = 0;
      }
    } else {
      status = "ABSENT (INVALID PUNCHES)";
    }

    detailedSchedule.push({
      date: dateStr,
      weekDay,
      clockIn,
      clockOut,
      regularHours,
      overtimeHours,
      totalShiftHours,
      status
    });
  });

  return detailedSchedule;
}