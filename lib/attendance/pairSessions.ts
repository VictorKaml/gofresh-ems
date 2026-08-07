// lib/attendance/pairSessions.ts
//
// Turns a raw stream of IN/OUT punches into shift "sessions", pairing each
// IN with the NEXT chronological OUT regardless of whether the calendar
// date rolls over in between. A session is reported under the date of its
// IN punch — so a night-shift employee who clocks in on the 6th at 20:00
// and clocks out on the 7th at 06:00 shows as ONE row on the 6th, not a
// missing punch on the 6th plus an orphan punch on the 7th.
//
// This only works correctly if you pass in a WINDOW of swipes per
// employee (at minimum: the target date plus the following day for night
// shift staff, or plus the previous day if you're rendering "today" and
// want to see whether last night's session is still open). Passing a
// single calendar day's swipes back in defeats the whole point.

export type ShiftType = "day" | "night";

export interface RawSwipe {
  id: string; // staffCode
  date: string; // "YYYY-MM-DD"
  weekDay?: string;
  time: string; // "HH:MM" or "HH:MM:SS"
  type: string; // contains "in" / "out", or "SK" / "AL" for leave
}

export interface ShiftSession {
  staffCode: string;
  attendanceDate: string; // date the session is reported under (date of IN, or of OUT if IN is missing)
  weekDay: string;
  clockIn: string | null; // "HH:MM" local to its own date
  clockOut: string | null; // "HH:MM" local to its own date (may be the next calendar day)
  crossesMidnight: boolean;
  totalShiftHours: number;
  status: "ON TIME" | "LATE" | "MISSED A CLOCK PUNCH";
}

// Default late-arrival cutoffs per roster sheet. Override per-call if a
// department needs a different shift start time.
export const DEFAULT_LATE_CUTOFF: Record<ShiftType, string> = {
  day: "07:30",
  night: "18:30",
};

const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

const toTimestamp = (date: string, time: string) =>
  new Date(`${date}T${normalizeTime(time)}`).getTime();

/**
 * Pair IN/OUT punches sequentially for a single employee. `swipes` should
 * already be filtered to that employee but MAY span multiple calendar
 * days (recommended: selected date ± 1 day). Leave swipes ("SK"/"AL")
 * are ignored here — handle leave-day overrides in the caller before/after
 * calling this, keyed off attendanceDate.
 */
export function pairSessions(
  staffCode: string,
  swipes: RawSwipe[],
  shiftType: ShiftType = "day",
  lateCutoff: string = DEFAULT_LATE_CUTOFF[shiftType],
): ShiftSession[] {
  const punches = swipes
    .filter((s) => {
      const t = s.type.toLowerCase();
      return s.id === staffCode && (t.includes("in") || t.includes("out"));
    })
    .map((s) => ({ ...s, ts: toTimestamp(s.date, s.time) }))
    .sort((a, b) => a.ts - b.ts);

  const sessions: ShiftSession[] = [];
  let openIn: (typeof punches)[number] | null = null;

  const buildSession = (
    inP: (typeof punches)[number] | null,
    outP: (typeof punches)[number] | null,
  ): ShiftSession => {
    const anchor = inP ?? outP!;
    const attendanceDate = anchor.date;
    const weekDay = anchor.weekDay || "";

    if (!inP || !outP) {
      return {
        staffCode,
        attendanceDate,
        weekDay,
        clockIn: inP ? inP.time : null,
        clockOut: outP ? outP.time : null,
        crossesMidnight: false,
        totalShiftHours: 0,
        status:
          inP && inP.time > lateCutoff ? "LATE" : "MISSED A CLOCK PUNCH",
      };
    }

    const hours = (outP.ts - inP.ts) / 3_600_000;
    return {
      staffCode,
      attendanceDate,
      weekDay,
      clockIn: inP.time,
      clockOut: outP.time,
      crossesMidnight: inP.date !== outP.date,
      totalShiftHours: Math.max(0, parseFloat(hours.toFixed(2))),
      status: inP.time > lateCutoff ? "LATE" : "ON TIME",
    };
  };

  for (const p of punches) {
    const isIn = p.type.toLowerCase().includes("in");
    if (isIn) {
      // A dangling IN with no OUT before the next IN starts — flag it as
      // missing rather than silently dropping it.
      if (openIn) sessions.push(buildSession(openIn, null));
      openIn = p;
    } else if (openIn) {
      sessions.push(buildSession(openIn, p));
      openIn = null;
    } else {
      // OUT with no preceding IN anywhere in the window — the matching IN
      // fell outside the fetched range. Surface it rather than dropping
      // it silently, so callers can widen the window if this shows up a lot.
      sessions.push(buildSession(null, p));
    }
  }
  if (openIn) sessions.push(buildSession(openIn, null));

  return sessions;
}

/**
 * Convenience wrapper: pair sessions for one employee across a window of
 * swipes, then return only the session(s) whose attendanceDate matches
 * the requested date. Use this in place of the old
 * `swipes.filter(s => s.date === dateStr)` pattern.
 */
export function sessionsForDate(
  staffCode: string,
  swipesWindow: RawSwipe[],
  dateStr: string,
  shiftType: ShiftType = "day",
  lateCutoff?: string,
): ShiftSession[] {
  return pairSessions(staffCode, swipesWindow, shiftType, lateCutoff).filter(
    (s) => s.attendanceDate === dateStr,
  );
}
