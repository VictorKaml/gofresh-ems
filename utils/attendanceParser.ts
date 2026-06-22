// utils/attendanceParser.ts

export interface ProcessedLog {
  id: string;
  name: string;
  designation: string;
  department: string;
  date: string;
  weekDay: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  status: 'On-Site' | 'Late Entry' | 'Missing Punch';
}

export interface MonthlySummary {
  id: string;
  name: string;
  department: string;
  designation: string;
  daysPresent: number;
  totalHours: number;
  totalLate: number;
  totalMissingPunches: number;
}

// Minimal helper to parse CSV lines safely accounting for commas in quotes
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseAttendanceDataset(
  rawTransactionsCsv: string,
  rawEmployeeCsv: string
): { dailyLogs: ProcessedLog[]; monthlySummaries: MonthlySummary[] } {
  
  // Step 1: Parse Employee Master Registry
  const employeeMap = new Map<string, { name: string; designation: string; dept: string }>();
  const empLines = rawEmployeeCsv.split('\n');
  
  empLines.forEach(line => {
    const columns = parseCsvLine(line);
    // Based on Master layout: Index 1 is Staff Code, Index 2 is Full Name, Index 3 is Designation, Index 4 is Department Name
    const staffCode = columns[1];
    if (staffCode && staffCode !== 'Staff Code' && staffCode.length > 2) {
      employeeMap.set(staffCode.toUpperCase(), {
        name: columns[2]?.toUpperCase() || 'UNKNOWN EMPLOYEE',
        designation: columns[3] || 'General Staff',
        dept: columns[4] || 'Operations'
      });
    }
  });

  // Step 2: Group Biometric Transits by Employee and Date
  const txLines = rawTransactionsCsv.split('\n');
  const groupedLogs: Record<string, Record<string, { rawTimes: string[]; weekDay: string }>> = {};

  txLines.forEach(line => {
    const columns = parseCsvLine(line);
    // Biometric CSV Format: Index 3 is ID, Index 4 is Date, Index 5 is Week, Index 6 is Time
    const id = columns[3]?.toUpperCase();
    const date = columns[4];
    const weekDay = columns[5];
    const time = columns[6];

    if (id && date && time && id !== 'ID') {
      if (!groupedLogs[id]) groupedLogs[id] = {};
      if (!groupedLogs[id][date]) {
        groupedLogs[id][date] = { rawTimes: [], weekDay };
      }
      groupedLogs[id][date].rawTimes.push(time);
    }
  });

  // Step 3: Compute Daily Aggregates & Flags
  const dailyLogs: ProcessedLog[] = [];
  const summaryMap = new Map<string, MonthlySummary>();

  Object.entries(groupedLogs).forEach(([id, dates]) => {
    const empMeta = employeeMap.get(id) || { name: `UNREGISTERED ID (${id})`, designation: 'Unknown', dept: 'Unassigned' };

    Object.entries(dates).forEach(([date, logData]) => {
      // Sort times chronologically to locate absolute boundary benchmarks
      const times = logData.rawTimes.sort((a, b) => a.localeCompare(b));
      const checkIn = times[0];
      const checkOut = times.length > 1 ? times[times.length - 1] : '—';

      // Evaluate shifting statuses
      let status: 'On-Site' | 'Late Entry' | 'Missing Punch' = 'On-Site';
      if (checkOut === '—') {
        status = 'Missing Punch';
      } else {
        // Compare with target core cutoff metric (e.g., 07:30 AM)
        if (checkIn > '07:30') {
          status = 'Late Entry';
        }
      }

      // Calculate total time duration span
      let hoursWorked = 0;
      if (checkOut !== '—') {
        const [inH, inM] = checkIn.split(':').map(Number);
        const [outH, outM] = checkOut.split(':').map(Number);
        hoursWorked = parseFloat(((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(2));
      }

      dailyLogs.push({
        id,
        name: empMeta.name,
        designation: empMeta.designation,
        department: empMeta.dept,
        date,
        weekDay: logData.weekDay,
        checkIn,
        checkOut,
        hoursWorked,
        status
      });

      // Accumulate metrics for Monthly view aggregate states
      if (!summaryMap.has(id)) {
        summaryMap.set(id, {
          id,
          name: empMeta.name,
          department: empMeta.dept,
          designation: empMeta.designation,
          daysPresent: 0,
          totalHours: 0,
          totalLate: 0,
          totalMissingPunches: 0
        });
      }

      const summary = summaryMap.get(id)!;
      summary.daysPresent += 1;
      summary.totalHours += hoursWorked;
      if (status === 'Late Entry') summary.totalLate += 1;
      if (status === 'Missing Punch') summary.totalMissingPunches += 1;
    });
  });

  return {
    dailyLogs: dailyLogs.sort((a, b) => b.date.localeCompare(a.date)),
    monthlySummaries: Array.from(summaryMap.values())
  };
}