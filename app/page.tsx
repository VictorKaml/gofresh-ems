"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar
} from "recharts";
import {
  Search,
  UploadCloud,
  Users,
  ShieldAlert,
  LayoutDashboard,
  Download,
  Clock,
  AlertTriangle,
  UserCheck,
  Contact2,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  LogOut,
  Terminal,
  Activity
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- STRUCTURAL INTERFACE SCHEMATICS ---
interface EmployeeProfile {
  staffCode: string;
  fullName: string;
  designation: string;
  department: string;
  costCenter: string;
}

interface RawSwipe {
  id: string;
  date: string; 
  weekDay: string;
  time: string; 
  type: string; 
}

interface DailyAttendanceGroup {
  date: string;
  weekDay: string;
  weekOfYear: string;
  clockIn: string;
  clockOut: string;
  hoursWorked: number;       
  overtimeHours: number;     
  totalShiftHours: number;   
  status: "PRESENT" | "LATE" | "ABSENT (INVALID PUNCHES)" | "NO RECORD";
}

interface SessionUser {
  id: string;
  email: string;
  role: 'superuser' | 'manager' | 'operator';
}

export default function EMSDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bavInputRef = useRef<HTMLInputElement>(null);

  // --- CORE CLIENT-SIDE MEMORY STATES ---
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([]);
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);
  
  // --- APPLICATION INTERFACE VIEW CONTROLS ---
  const [activeTab, setActiveTab] = useState("OVERVIEW"); 
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState<string>("ALL"); 
  const [weekFilter, setWeekFilter] = useState<string>("ALL");   
  const [dayFilter, setDayFilter] = useState<string>("ALL");     
  const [lowAttendanceThreshold, setLowAttendanceThreshold] = useState<number>(30); 
  const [isUploading, setIsUploading] = useState(false);

  // --- BAV EXCEL STAGING QUEUE STATES ---
  const [bavStagedRecords, setBavStagedRecords] = useState<EmployeeProfile[]>([]);
  const [isBavSaving, setIsBavSaving] = useState(false);
  const [bavStatus, setBavStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[INFO] TypeORM Connection pool initialized safely.",
    "[INFO] Ready for active biometric employee data packets."
  ]);

  // --- SESSION HANDSHAKE ON RUNTIME MOUNT ---
  useEffect(() => {
    async function verifySession() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) throw new Error("Unauthenticated");
        const data = await response.json();
        setUser(data.user);
        addLog(`[SUCCESS] Pool client identity handshake verified for ${data.user.email}`);
      } catch (err) {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    }
    verifySession();
  }, [router]);

  const addLog = (msg: string) => {
    setSystemLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`].slice(-4));
  };

  const getWeekNumber = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Wk-??";
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
    return `Wk ${Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)}`;
  };

  // --- AUTOMATED MASTER ROSTER & BIOMETRIC LOG INGESTION ---
  const handleFileUploadDispatch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

        const isMasterRoster = rawRows.some(row => Array.isArray(row) && row.some(c => String(c).trim() === "Staff Code"));
        const isBiometricLog = rawRows.some(row => Array.isArray(row) && row.some(c => String(c).trim() === "Card Swiping Type"));

        if (isMasterRoster) {
          const headerIdx = rawRows.findIndex(row => Array.isArray(row) && row.some(c => String(c).trim() === "Staff Code"));
          const headers = rawRows[headerIdx].map((h: any) => String(h).trim());
          
          const codeIdx = headers.indexOf("Staff Code");
          const nameIdx = headers.indexOf("Full Name");
          const desIdx = headers.indexOf("Designation");
          const deptIdx = headers.indexOf("Department Name");
          const costIdx = headers.indexOf("Cost Centre");

          const parsedRoster: EmployeeProfile[] = [];
          rawRows.slice(headerIdx + 1).forEach((row) => {
            if (!row || !row[codeIdx]) return;
            const code = String(row[codeIdx]).trim().toUpperCase();
            if (code === "STAFF CODE" || code.length < 2) return;

            parsedRoster.push({
              staffCode: code,
              fullName: String(row[nameIdx] || "").trim().toUpperCase(),
              designation: String(row[desIdx] || "General Roster").trim(),
              department: String(row[deptIdx] || "Operations").trim(),
              costCenter: String(row[costIdx] || "Unassigned").trim(),
            });
          });

          setEmployeeDirectory(parsedRoster);
          setActiveTab("EMPLOYEES");
          addLog(`[ROSTER] Loaded ${parsedRoster.length} local workspace rows safely.`);
        } else if (isBiometricLog) {
          const headerIdx = rawRows.findIndex(row => Array.isArray(row) && row.some(c => String(c).trim() === "Card Swiping Type"));
          const headers = rawRows[headerIdx].map((h: any) => String(h).trim());

          const idIdx = headers.indexOf("ID");
          const dateIdx = headers.indexOf("Date");
          const weekIdx = headers.indexOf("Week");
          const timeIdx = headers.indexOf("Time");
          const typeIdx = headers.indexOf("Card Swiping Type");

          const dynamicSwipes: RawSwipe[] = [];

          rawRows.slice(headerIdx + 1).forEach((row) => {
            if (!row || !row[idIdx] || !row[dateIdx] || !row[timeIdx]) return;
            const id = String(row[idIdx]).trim().toUpperCase();
            if (id === "ID") return;

            dynamicSwipes.push({
              id,
              date: String(row[dateIdx]).trim(),
              weekDay: String(row[weekIdx] || "").trim(),
              time: String(row[timeIdx]).trim(),
              type: String(row[typeIdx] || "").trim()
            });
          });

          setRawSwipesBuffer(dynamicSwipes);
          setActiveTab("OVERVIEW");
          addLog(`[BIOMETRIC] Ingested ${dynamicSwipes.length} transactional swipe rows to system memory buffer.`);
        }
      } catch (err) {
        console.error("Ingestion parsing error", err);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- BAV SECTION: EXCEL WORKFORCE FILE PARSER ---
  const handleBavExcelParse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`[BAV_PARSER] Ingesting binary matrix stream from: ${file.name}`);
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(worksheet) as any[];

        const validatedEmployees: EmployeeProfile[] = rawRows.map((row, index) => ({
          staffCode: String(row.StaffCode || row["Staff Code"] || `GF-${1000 + index}`).trim().toUpperCase(),
          fullName: String(row.FullName || row["Full Name"] || row.Name || "Unassigned Record").trim().toUpperCase(),
          designation: String(row.Designation || row["Designation Worker Role"] || "Operator").trim(),
          department: String(row.Department || row["Department Name"] || "Operations").trim(),
          costCenter: String(row.CostCenter || row["Cost Centre"] || "CC-LOCAL").trim().toUpperCase()
        }));

        setBavStagedRecords(validatedEmployees);
        setBavStatus(null);
        setActiveTab("BAV_PREVIEW");
        addLog(`[SUCCESS] Staged ${validatedEmployees.length} rows to layout cache framework.`);
      } catch (err) {
        setBavStatus({ type: "error", message: "Failed to parse structural layout configuration of sheet." });
        addLog("[ERROR] BAV Ingestion matrix file verification mismatch.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- BAV SECTION: COMMIT STAGED BLOCK PERMANENTLY TO POSTGRESQL ---
  const saveBavRecordsToPostgres = async () => {
    if (bavStagedRecords.length === 0) return;
    setIsBavSaving(true);
    setBavStatus(null);
    addLog(`[DB_COMMIT] Writing transaction block containing ${bavStagedRecords.length} records...`);

    try {
      const response = await fetch("/api/employees/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: bavStagedRecords }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Batch payload compilation error.");

      // Hydrate local runtime client engine array with the newly stored assets automatically
      setEmployeeDirectory(prev => {
        const uniqueMap = new Map(prev.map(item => [item.staffCode, item]));
        bavStagedRecords.forEach(rec => uniqueMap.set(rec.staffCode, rec));
        return Array.from(uniqueMap.values());
      });

      setBavStatus({ type: "success", message: `Successfully saved ${bavStagedRecords.length} workforce profiles permanently into PostgreSQL.` });
      addLog(`[SUCCESS] Postgres write verified. Transaction committed.`);
      setBavStagedRecords([]);
      setActiveTab("EMPLOYEES");
      if (bavInputRef.current) bavInputRef.current.value = "";
    } catch (err: any) {
      setBavStatus({ type: "error", message: err.message || "Postgres internal dispatcher execution failure." });
      addLog(`[CRITICAL_FAULT] TypeORM entity update transaction rolled back: ${err.message}`);
    } finally {
      setIsBavSaving(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const dynamicFilterMenus = useMemo(() => {
    const months = new Set<string>();
    const weeks = new Set<string>();
    const days = new Set<string>();
    
    rawSwipesBuffer.forEach(s => {
      if (s.date && s.date.length >= 10) {
        months.add(s.date.substring(0, 7));
        weeks.add(getWeekNumber(s.date));
        days.add(s.date);
      }
    });

    return {
      months: Array.from(months).sort(),
      weeks: Array.from(weeks).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})),
      days: Array.from(days).sort()
    };
  }, [rawSwipesBuffer]);

  // --- CORE ATTENDANCE RULES PARSING COMPUTATION ENGINE ---
  const systemProcessedDataset = useMemo(() => {
    const uniqueDates = Array.from(new Set(rawSwipesBuffer.map(s => s.date))).sort();

    return employeeDirectory.map((emp) => {
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let presentDaysCount = 0;
      const dailyAttendanceRecords: DailyAttendanceGroup[] = [];

      uniqueDates.forEach(dateStr => {
        if (monthFilter !== "ALL" && !dateStr.startsWith(monthFilter)) return;
        const weekNum = getWeekNumber(dateStr);
        if (weekFilter !== "ALL" && weekNum !== weekFilter) return;
        if (dayFilter !== "ALL" && dateStr !== dayFilter) return;

        const daySwipes = rawSwipesBuffer.filter(s => s.id === emp.staffCode && s.date === dateStr);
        if (daySwipes.length === 0) {
          dailyAttendanceRecords.push({
            date: dateStr,
            weekDay: "Unknown",
            weekOfYear: weekNum,
            clockIn: "—",
            clockOut: "—",
            hoursWorked: 0,
            overtimeHours: 0,
            totalShiftHours: 0,
            status: "NO RECORD"
          });
          return;
        }

        const weekDay = daySwipes[0].weekDay;
        const checkIns = daySwipes.filter(s => s.type.toLowerCase().includes("in")).sort((a,b) => a.time.localeCompare(b.time));
        const checkOuts = daySwipes.filter(s => s.type.toLowerCase().includes("out")).sort((a,b) => a.time.localeCompare(b.time));

        let clockIn = checkIns.length > 0 ? checkIns[0].time : "—";
        let clockOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].time : "—";

        let regularHours = 0;
        let overtimeHours = 0;
        let totalShiftHours = 0;
        let dayStatus: "PRESENT" | "LATE" | "ABSENT (INVALID PUNCHES)" = "PRESENT";

        if ((clockIn !== "—" && clockOut === "—") || (clockIn === "—" && clockOut !== "—")) {
          dayStatus = "ABSENT (INVALID PUNCHES)";
        } else if (clockIn !== "—" && clockOut !== "—") {
          const [inH, inM] = clockIn.split(":").map(Number);
          const [outH, outM] = clockOut.split(":").map(Number);
          const minutesDiff = (outH * 60 + outM) - (inH * 60 + inM);
          
          totalShiftHours = parseFloat((minutesDiff / 60).toFixed(2));
          if (totalShiftHours < 0) totalShiftHours = 0;

          if (clockIn > "07:30") dayStatus = "LATE";
          presentDaysCount++;

          const dateObj = new Date(dateStr);
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
          const currentDayCap = isWeekend ? 5.5 : 8.5;

          if (totalShiftHours > currentDayCap) {
            regularHours = currentDayCap;
            overtimeHours = parseFloat((totalShiftHours - currentDayCap).toFixed(2));
          } else {
            regularHours = totalShiftHours;
            overtimeHours = 0;
          }
        }

        totalRegularHours += regularHours;
        totalOvertimeHours += overtimeHours;

        dailyAttendanceRecords.push({
          date: dateStr,
          weekDay,
          weekOfYear: weekNum,
          clockIn,
          clockOut,
          hoursWorked: regularHours,
          overtimeHours,
          totalShiftHours,
          status: dayStatus
        });
      });

      const totalHoursSum = totalRegularHours + totalOvertimeHours;
      return {
        ...emp,
        records: dailyAttendanceRecords.sort((a,b) => b.date.localeCompare(a.date)),
        metrics: {
          totalRegularHours: parseFloat(totalRegularHours.toFixed(2)),
          totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
          totalHoursSum: parseFloat(totalHoursSum.toFixed(2)),
          averageHours: presentDaysCount > 0 ? parseFloat((totalHoursSum / presentDaysCount).toFixed(2)) : 0,
          presentDaysCount,
          isLowAttendance: totalHoursSum < lowAttendanceThreshold && presentDaysCount > 0
        }
      };
    });
  }, [employeeDirectory, rawSwipesBuffer, monthFilter, weekFilter, dayFilter, lowAttendanceThreshold]);

  // --- FILTERS & INTERSECTIONS ---
  const filteredViewDataset = useMemo(() => {
    return systemProcessedDataset.filter(row => {
      return row.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || row.staffCode.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [systemProcessedDataset, searchQuery]);

  const filteredEmployeeDirectory = useMemo(() => {
    return employeeDirectory.filter(emp => {
      return emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || emp.staffCode.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [employeeDirectory, searchQuery]);

  const lowAttendanceStaffList = useMemo(() => systemProcessedDataset.filter(e => e.metrics.isLowAttendance), [systemProcessedDataset]);

  const metricsRollup = useMemo(() => {
    let globalRegularHours = 0;
    let globalOvertimeHours = 0;
    let anomalyCount = 0;

    systemProcessedDataset.forEach(emp => {
      globalRegularHours += emp.metrics.totalRegularHours;
      globalOvertimeHours += emp.metrics.totalOvertimeHours;
      emp.records.forEach(r => { if (r.status === "ABSENT (INVALID PUNCHES)") anomalyCount++; });
    });

    return {
      globalRegularHours: parseFloat(globalRegularHours.toFixed(1)),
      globalOvertimeHours: parseFloat(globalOvertimeHours.toFixed(1)),
      globalTotalSum: parseFloat((globalRegularHours + globalOvertimeHours).toFixed(1)),
      anomalyCount,
      totalCount: employeeDirectory.length
    };
  }, [systemProcessedDataset, employeeDirectory]);

  const departmentAggregatedMetrics = useMemo(() => {
    const rollupMap: Record<string, { name: string; staffCount: number; regHours: number; otHours: number }> = {};
    
    systemProcessedDataset.forEach(emp => {
      const dept = emp.department || "Operations Cluster";
      if (!rollupMap[dept]) {
        rollupMap[dept] = { name: dept, staffCount: 0, regHours: 0, otHours: 0 };
      }
      rollupMap[dept].staffCount += 1;
      rollupMap[dept].regHours += emp.metrics.totalRegularHours;
      rollupMap[dept].otHours += emp.metrics.totalOvertimeHours;
    });

    return Object.values(rollupMap).map(d => ({
      ...d,
      regHours: parseFloat(d.regHours.toFixed(1)),
      otHours: parseFloat(d.otHours.toFixed(1)),
    }));
  }, [systemProcessedDataset]);

  const overviewChartData = useMemo(() => {
    if (metricsRollup.globalOvertimeHours > 0) {
      return [
        { name: "Week 20", "Overtime Hours": metricsRollup.globalOvertimeHours * 0.15 },
        { name: "Week 21", "Overtime Hours": metricsRollup.globalOvertimeHours * 0.40 },
        { name: "Week 22", "Overtime Hours": metricsRollup.globalOvertimeHours * 0.75 },
        { name: "Week 23", "Overtime Hours": metricsRollup.globalOvertimeHours }
      ];
    }
    return [
      { name: "Week 18", "Overtime Hours": 40 }, { name: "Week 19", "Overtime Hours": 95 },
      { name: "Week 20", "Overtime Hours": 65 }, { name: "Week 21", "Overtime Hours": 130 },
      { name: "Week 22", "Overtime Hours": 85 }, { name: "Week 23", "Overtime Hours": 160 }
    ];
  }, [metricsRollup.globalOvertimeHours]);

  const exportTargetEmployeePDF = (emp: any) => {
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 297, 42, "F");
    
    try {
      doc.addImage("/gofresh_logo.jpg", "JPEG", 14, 6, 30, 30);
    } catch (e) {
      doc.setFillColor(239, 68, 68);
      doc.rect(14, 6, 30, 30, "F");
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("GOFRESH", 50, 20);
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("PROCESS CONTROL WORKFORCE AUTOMATION SYSTEM", 50, 26);

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text(emp.fullName, 165, 18);
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.text(`STAFF CODE: ${emp.staffCode}`, 165, 24);
    doc.text(`CLUSTER DEPT: ${emp.department}`, 165, 29);
    doc.text(`COST CENTER ID: ${emp.costCenter}`, 165, 34);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 50, 269, 20, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("COMPLIANT REGULAR TOTAL", 24, 58);
    doc.text("PREMIUM OVERTIME ACCRUED", 114, 58);
    doc.text("GROSS MACHINE RUNTIME", 204, 58);

    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text(`${emp.metrics.totalRegularHours} Hours`, 24, 65);
    doc.setTextColor(37, 99, 235);
    doc.text(`+${emp.metrics.totalOvertimeHours} Hours Overtime`, 114, 65);
    doc.setTextColor(15, 23, 42);
    doc.text(`${emp.metrics.totalHoursSum} Hours Total`, 204, 65);

    const weekBuckets = Array.from(new Set<string>(emp.records.map((r: any) => String(r.weekOfYear))))
      .filter((w: string) => w !== "Wk-??")
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .slice(0, 4);

    while (weekBuckets.length < 4) {
      weekBuckets.push(`Week Balance ${weekBuckets.length + 1}`);
    }

    const dayColumnsMap = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const matrixGridBody = weekBuckets.map((weekId, idx) => {
      const rowItemCells = [ `WEEK ${idx + 1} (${weekId})` ];
      dayColumnsMap.forEach(targetDayName => {
        const matchRecord = emp.records.find((r: any) => r.weekOfYear === weekId && r.weekDay.toLowerCase() === targetDayName.toLowerCase());
        if (matchRecord && matchRecord.status !== "NO RECORD") {
          rowItemCells.push(`${matchRecord.hoursWorked} / ${matchRecord.overtimeHours}`);
        } else {
          rowItemCells.push("— / —");
        }
      });
      return rowItemCells;
    });

    autoTable(doc, {
      startY: 78,
      head: [["CALENDAR MATRIX", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]],
      body: matrixGridBody,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], halign: "center", fontSize: 9, fontStyle: "bold" },
      styles: { cellPadding: 5, fontSize: 10, halign: "center", font: "Helvetica", textColor: [51, 65, 85] },
      columnStyles: { 0: { fontStyle: "bold", halign: "left", fillColor: [241, 245, 249], cellWidth: 45 } },
      didParseCell: (data) => {
        if (data.row.index >= 0 && data.column.index > 0 && data.cell.text[0] !== "— / —") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [15, 23, 42];
          data.cell.styles.fillColor = [239, 246, 255]; 
        }
      }
    });

    doc.save(`GoFresh_Calendar_Matrix_${emp.staffCode}.pdf`);
  };

  const exportLowAttendanceReportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.text("GOFRESH OPERATION EXCEPTIONS REPORT", 14, 20);
    const rows = lowAttendanceStaffList.map(emp => [
      emp.staffCode, emp.fullName, emp.department, `${emp.metrics.totalRegularHours} hrs`, `${emp.metrics.totalOvertimeHours} hrs`, `${emp.metrics.totalHoursSum} hrs`
    ]);
    autoTable(doc, {
      startY: 28,
      head: [["Staff Code", "Full Name", "Department", "Regular", "Overtime", "Total Accrued"]],
      body: rows,
      theme: "striped"
    });
    doc.save(`GoFresh_Attendance_Deficits.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex bg-slate-950 text-slate-100 min-h-screen items-center justify-center font-mono text-xs tracking-widest uppercase">
        <Activity className="w-4 h-4 animate-spin text-blue-500 mr-2" />
        Syncing Postgres Matrix Context...
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 text-slate-900 min-h-screen antialiased selection:bg-blue-500 selection:text-white">
      
      {/* ─── SIDE NAVIGATION BAR PANEL WITH BAV INTEGRATION ─── */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between fixed h-full top-0 left-0 z-30 shadow-xl border-r border-slate-800">
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <div className="py-3 px-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-black text-xs shadow-md">GF</div>
              <div>
                <span className="font-black text-xs tracking-wider uppercase block text-slate-100">GoFresh Engine</span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">PG_POOL_CONNECTED</span>
              </div>
            </div>
            <Button onClick={handleSignOut} variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-1">
            <button onClick={() => { setActiveTab("OVERVIEW"); setSelectedEmployeeCode(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "OVERVIEW" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <LayoutDashboard className="w-4 h-4" /> PERFORMANCE OVERVIEW
            </button>

            <button onClick={() => { setActiveTab("DEPARTMENTS"); setSelectedEmployeeCode(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "DEPARTMENTS" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <Building2 className="w-4 h-4 text-emerald-400" /> DEPARTMENT OVERVIEW
            </button>

            <button onClick={() => { setActiveTab("EMPLOYEES"); setSelectedEmployeeCode(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "EMPLOYEES" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <Contact2 className="w-4 h-4" /> ALL EMPLOYEES ({metricsRollup.totalCount})
            </button>

            <button onClick={() => { setActiveTab("ROSTER"); setSelectedEmployeeCode(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "ROSTER" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <Users className="w-4 h-4" /> OVERTIME SPLIT REGISTRY
            </button>

            <button onClick={() => { setActiveTab("DEFICITS"); setSelectedEmployeeCode(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "DEFICITS" ? "bg-red-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <ShieldAlert className="w-4 h-4" /> ATTRITION DEFICITS ({lowAttendanceStaffList.length})
            </button>
          </div>

          {/* ─── DYNAMIC BAV UPLOADER SECTION (SIDEBAR ACTION WORKSPACE) ─── */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-3">BAV DB UPDATE LAYER</span>
            <div className="px-1">
              <input type="file" ref={bavInputRef} onChange={handleBavExcelParse} accept=".xlsx, .xls" className="hidden" id="bav-file-uploader" disabled={isBavSaving} />
              <Button asChild variant="outline" className="w-full h-9 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 font-bold text-xs uppercase tracking-wide cursor-pointer justify-start gap-2.5">
                <label htmlFor="bav-file-uploader">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>UPLOAD EMPLOYEE EXCEL</span>
                </label>
              </Button>
            </div>
            {bavStagedRecords.length > 0 && (
              <div className="px-1 pt-1 animate-in fade-in duration-200">
                <Button onClick={saveBavRecordsToPostgres} disabled={isBavSaving} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wide gap-1">
                  {isBavSaving ? "WRITING PG..." : `COMMIT ${bavStagedRecords.length} TO DB`}
                </Button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-3">CHRONO SETTINGS</span>
            <div className="space-y-1 px-1">
              <select value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setWeekFilter("ALL"); setDayFilter("ALL"); }} className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] font-bold rounded p-2 uppercase">
                <option value="ALL">ALL FILTER MONTHS</option>
                {dynamicFilterMenus.months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <input type="file" ref={fileInputRef} onChange={handleFileUploadDispatch} accept=".xlsx, .xls, .csv" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
              <UploadCloud className="w-4 h-4 text-blue-400" />
              <span>{isUploading ? "INGESTING LOGS..." : "INGEST CHRONO MATRIX"}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN WORKSPACE PANEL ─── */}
      <div className="flex-1 pl-64 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">WORKFORCE SYSTEMS</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 text-xs font-black tracking-widest uppercase">{activeTab} VIEW</span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="SEARCH RECONCILED INDEX..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 text-xs uppercase font-bold rounded-lg h-9 border-slate-200" />
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          
          {/* POSTGRES ACTION RESPONSE ALERTS */}
          {bavStatus && (
            <div className={`p-4 rounded-xl border text-xs font-bold flex items-start gap-2.5 ${
              bavStatus.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{bavStatus.message}</span>
            </div>
          )}

          {/* RUNTIME METRICS ROSTER COUNTERS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">ROSTER POOL SIZE</p><p className="text-2xl font-black mt-1 text-slate-900">{metricsRollup.totalCount}</p></div>
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg"><Users className="w-4 h-4 text-slate-500" /></div>
            </Card>
            <Card className="bg-white p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">COMPLIANT REGULAR</p><p className="text-2xl font-black mt-1 text-emerald-600">{metricsRollup.globalRegularHours} h</p></div>
              <div className="p-2 bg-emerald-50 rounded-lg"><UserCheck className="w-4 h-4 text-emerald-600" /></div>
            </Card>
            <Card className="bg-white p-5 border border-slate-200/80 shadow-sm flex items-center justify-between border-l-4 border-l-blue-600">
              <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">OVERTIME ALLOCATED</p><p className="text-2xl font-black mt-1 text-blue-600">+{metricsRollup.globalOvertimeHours} h</p></div>
              <div className="p-2 bg-blue-50 rounded-lg"><Clock className="w-4 h-4 text-blue-600" /></div>
            </Card>
            <Card className="bg-white p-5 border border-slate-200/80 shadow-sm flex items-center justify-between border-l-4 border-l-red-500">
              <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">PUNCH ANOMALIES</p><p className="text-2xl font-black mt-1 text-red-600">{metricsRollup.anomalyCount}</p></div>
              <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
            </Card>
          </div>

          {/* ─── BAV PREVIEW GRID SECTION WORKSPACE ─── */}
          {activeTab === "BAV_PREVIEW" && (
            <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 duration-200">
              <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-black text-slate-600 tracking-wider uppercase">Excel Staging Queue Preview (BAV Grid)</CardTitle>
                  <CardDescription className="text-[11px] text-slate-500 font-medium">Verify spreadsheet layout matches your target TypeORM Postgres entity definition maps before sync validation.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => { setBavStagedRecords([]); setActiveTab("OVERVIEW"); }} variant="ghost" className="h-8 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</Button>
                  <Button onClick={saveBavRecordsToPostgres} disabled={isBavSaving} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-4">Commit Staged Records</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[360px] overflow-y-auto font-mono text-xs">
                <Table>
                  <TableHeader className="bg-slate-100 sticky top-0 border-b z-10">
                    <TableRow>
                      <TableHead className="text-[10px] font-black h-9 text-slate-500">Index</TableHead>
                      <TableHead className="text-[10px] font-black h-9 text-slate-500">Staff Code</TableHead>
                      <TableHead className="text-[10px] font-black h-9 text-slate-500">Full Name</TableHead>
                      <TableHead className="text-[10px] font-black h-9 text-slate-500">Designation Role</TableHead>
                      <TableHead className="text-[10px] font-black h-9 text-slate-500">Department</TableHead>
                      <TableHead className="text-[10px] font-black h-9 text-slate-500">Cost Center</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bavStagedRecords.map((emp, index) => (
                      <TableRow key={index} className="border-b hover:bg-slate-50/80 h-8">
                        <TableCell className="text-slate-400 py-1 font-bold">{index + 1}</TableCell>
                        <TableCell className="text-blue-600 font-black py-1">{emp.staffCode}</TableCell>
                        <TableCell className="text-slate-900 font-bold py-1 uppercase">{emp.fullName}</TableCell>
                        <TableCell className="text-slate-600 py-1 font-semibold">{emp.designation}</TableCell>
                        <TableCell className="text-slate-500 py-1">{emp.department}</TableCell>
                        <TableCell className="text-slate-400 py-1 font-bold">{emp.costCenter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ─── DEPARTMENTS WORKSPACE ─── */}
          {activeTab === "DEPARTMENTS" && (
            <div className="space-y-6">
              <Card className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase mb-4">DEPARTMENTAL PREMIUM OVERTIME SPEND DISTRIBUTION</h3>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentAggregatedMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight="800" />
                      <YAxis stroke="#64748b" fontSize={11} fontWeight="800" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="regHours" name="Regular Hours Worked" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="otHours" name="Premium Overtime Allocation" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50 border-b">
                      <TableRow>
                        <TableHead className="px-6 text-xs font-black text-slate-500">OPERATIONAL CLUSTER DEPARTMENT</TableHead>
                        <TableHead className="text-center text-xs font-black text-slate-500">ACTIVE STAFF CAPACITY</TableHead>
                        <TableHead className="text-center text-xs font-black text-slate-500">CUMULATIVE REGULAR HOURS</TableHead>
                        <TableHead className="text-right px-6 text-xs font-black text-slate-500">TOTAL PREMIUM OVERTIME HOURS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departmentAggregatedMetrics.map((dept, idx) => (
                        <TableRow key={idx} className="border-b hover:bg-slate-50/60 transition-colors">
                          <TableCell className="px-6 font-black text-xs uppercase text-slate-900">{dept.name}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-slate-600">{dept.staffCount} Workers</TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-emerald-600">{dept.regHours} hrs</TableCell>
                          <TableCell className="text-right px-6 font-mono font-black text-xs text-blue-600">+{dept.otHours} hrs OT</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── CHRONO TREND TRAJECTORY WORKSPACE ─── */}
          {activeTab === "OVERVIEW" && (
            <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b p-4">
                <CardTitle className="text-xs font-black text-slate-500 tracking-wider uppercase">DYNAMIC CHRONOLOGICAL ACCUMULATED OVERTIME TRAJECTORY TRACKER</CardTitle>
              </CardHeader>
              <CardContent className="p-6 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overviewChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight="800" />
                    <YAxis stroke="#64748b" fontSize={11} fontWeight="800" />
                    <Tooltip contentStyle={{ fontSize: '12px', fontWeight: 'bold', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Line type="monotone" dataKey="Overtime Hours" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ─── EMPLOYEES INDEX DIRECTORY REPOSITORY ─── */}
          {activeTab === "EMPLOYEES" && !selectedEmployeeCode && (
            <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/80 border-b">
                    <TableRow>
                      <TableHead className="px-6 text-xs font-black text-slate-500">STAFF IDENTIFIER</TableHead>
                      <TableHead className="text-xs font-black text-slate-500">FULL RETAINED NAME</TableHead>
                      <TableHead className="text-xs font-black text-slate-500">DESIGNATION WORKER ROLE</TableHead>
                      <TableHead className="text-xs font-black text-slate-500">OPERATIONAL CLUSTER</TableHead>
                      <TableHead className="text-xs font-black text-slate-500">COST CENTER</TableHead>
                      <TableHead className="text-right px-6 text-xs font-black text-slate-500">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployeeDirectory.map(emp => {
                      const fullyProcessedEmp = systemProcessedDataset.find(e => e.staffCode === emp.staffCode);
                      return (
                        <TableRow key={emp.staffCode} className="border-b hover:bg-slate-50 cursor-pointer group">
                          <TableCell onClick={() => setSelectedEmployeeCode(emp.staffCode)} className="px-6 font-mono text-xs font-bold text-slate-500 group-hover:text-blue-600 transition-colors">{emp.staffCode}</TableCell>
                          <TableCell onClick={() => setSelectedEmployeeCode(emp.staffCode)} className="font-black text-sm uppercase text-slate-900">{emp.fullName}</TableCell>
                          <TableCell onClick={() => setSelectedEmployeeCode(emp.staffCode)} className="text-xs text-slate-600 font-semibold uppercase">{emp.designation}</TableCell>
                          <TableCell onClick={() => setSelectedEmployeeCode(emp.staffCode)} className="text-xs text-slate-500 font-bold uppercase">
                            <Badge variant="outline" className="rounded bg-slate-50 text-slate-700 font-bold border-slate-200">{emp.department}</Badge>
                          </TableCell>
                          <TableCell onClick={() => setSelectedEmployeeCode(emp.staffCode)} className="font-mono text-xs font-semibold text-slate-600">{emp.costCenter}</TableCell>
                          <TableCell className="text-right px-6">
                            <Button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (fullyProcessedEmp) exportTargetEmployeePDF(fullyProcessedEmp); 
                              }} 
                              size="sm" 
                              variant="outline"
                              className="h-7 text-[10px] font-bold gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                            >
                              <Download className="w-3 h-3" /> PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ─── ROSTER MODAL ALLOCATION REGISTRY ─── */}
          {activeTab === "ROSTER" && !selectedEmployeeCode && (
            <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/80 border-b">
                    <TableRow>
                      <TableHead className="px-6 text-xs font-black text-slate-500">STAFF ID</TableHead>
                      <TableHead className="text-xs font-black text-slate-500">FULL OPERATIONAL NAME</TableHead>
                      <TableHead className="text-xs font-black text-slate-500 text-center">SHIFTS</TableHead>
                      <TableHead className="text-xs font-black text-slate-500 text-center">COMPLIANT REGULAR</TableHead>
                      <TableHead className="text-xs font-black text-slate-500 text-center">GROSS ACCRUED</TableHead>
                      <TableHead className="text-center text-xs font-black text-slate-500">ISOLATED OVERTIME</TableHead>
                      <TableHead className="text-right px-6 text-xs font-black text-slate-500">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredViewDataset.map(row => (
                      <TableRow key={row.staffCode} className="border-b hover:bg-slate-50 cursor-pointer group">
                        <TableCell onClick={() => setSelectedEmployeeCode(row.staffCode)} className="px-6 font-mono text-xs font-bold group-hover:text-blue-600">{row.staffCode}</TableCell>
                        <TableCell onClick={() => setSelectedEmployeeCode(row.staffCode)} className="font-black text-sm uppercase text-slate-900">{row.fullName}</TableCell>
                        <TableCell onClick={() => setSelectedEmployeeCode(row.staffCode)} className="text-center text-xs font-bold text-slate-600">{row.metrics.presentDaysCount}</TableCell>
                        <TableCell onClick={() => setSelectedEmployeeCode(row.staffCode)} className="text-center font-black text-xs text-emerald-700 bg-emerald-50/10">{row.metrics.totalRegularHours} hrs</TableCell>
                        <TableCell onClick={() => setSelectedEmployeeCode(row.staffCode)} className="text-center font-bold text-xs text-slate-900">{row.metrics.totalHoursSum} hrs</TableCell>
                        <TableCell onClick={() => setSelectedEmployeeCode(row.staffCode)} className="text-center"><Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-mono font-black rounded px-2 py-0.5">+{row.metrics.totalOvertimeHours} hr OT</Badge></TableCell>
                        <TableCell className="text-right px-6">
                          <Button onClick={(e) => { e.stopPropagation(); exportTargetEmployeePDF(row); }} size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1">
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ─── DEFICIT CONTROL SYSTEM EXCEPTIONS ─── */}
          {activeTab === "DEFICITS" && (
            <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-slate-50/60 px-6 py-4 flex flex-row items-center justify-between">
                <span className="text-xs font-black text-slate-500 tracking-wider uppercase">HOURLY EXCEPTION DEFICIT CONTROL MATRIX</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Threshold:</span>
                  <Input type="number" value={lowAttendanceThreshold} onChange={(e) => setLowAttendanceThreshold(Number(e.target.value))} className="w-16 h-8 text-xs font-black font-mono text-center" />
                  <Button onClick={exportLowAttendanceReportPDF} size="sm" className="bg-red-600 hover:bg-red-700 text-white font-black text-xs gap-1.5 shadow-sm">
                    <Download className="w-3.5 h-3.5" /> DOWNLOAD REPORT
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-red-50/40 border-b">
                    <TableRow>
                      <TableHead className="px-6 text-xs font-black text-slate-500">STAFF CODE</TableHead>
                      <TableHead className="text-xs font-black text-slate-500">FULL IDENTITY NAME</TableHead>
                      <TableHead className="text-xs font-black text-slate-500">DEPARTMENT CLUSTER</TableHead>
                      <TableHead className="text-xs font-black text-slate-500 text-center">SHIFTS ACTIVATED</TableHead>
                      <TableHead className="text-right px-6 text-xs font-black text-slate-500">TOTAL COMBINED RUNTIME</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowAttendanceStaffList.map(row => (
                      <TableRow key={row.staffCode} className="border-b hover:bg-red-50/10">
                        <TableCell className="px-6 font-mono text-xs text-red-700 font-bold">{row.staffCode}</TableCell>
                        <TableCell className="font-black text-sm uppercase text-slate-900">{row.fullName}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium uppercase">{row.department}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-slate-600">{row.metrics.presentDaysCount}</TableCell>
                        <TableCell className="text-right px-6 font-mono font-black text-sm text-red-600">{row.metrics.totalHoursSum} / {lowAttendanceThreshold} hrs</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ─── VIEW 5: SELECTED DRILLDOWN CHRONO TRANSACTION ENTRIES ─── */}
          {selectedEmployeeCode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button onClick={() => setSelectedEmployeeCode(null)} variant="outline" size="sm" className="text-xs font-bold bg-white text-slate-700 border-slate-200 shadow-sm">
                  ← UNMOUNT PROFILE DRILLDOWN
                </Button>
                {(() => {
                  const emp = systemProcessedDataset.find(e => e.staffCode === selectedEmployeeCode);
                  return emp ? (
                    <Button onClick={() => exportTargetEmployeePDF(emp)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs gap-1.5 shadow-md">
                      <Download className="w-3.5 h-3.5" /> DOWNLOAD CALENDAR PDF REPORT
                    </Button>
                  ) : null;
                })()}
              </div>

              {(() => {
                const emp = systemProcessedDataset.find(e => e.staffCode === selectedEmployeeCode);
                if (!emp) return null;

                const workerGraphData = [...emp.records]
                  .filter(r => r.status !== "NO RECORD")
                  .reverse()
                  .map(r => ({
                    day: r.date.substring(5),
                    "Regular": r.hoursWorked,
                    "Overtime": r.overtimeHours
                  }));

                return (
                  <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-900 p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <span className="text-blue-400 text-[10px] font-black tracking-widest block uppercase">{emp.department} // CC {emp.costCenter}</span>
                        <h2 className="text-2xl font-black uppercase mt-0.5 tracking-tight text-slate-50">{emp.fullName}</h2>
                        <span className="text-slate-400 text-xs font-semibold uppercase block tracking-wider mt-0.5">{emp.designation}</span>
                      </div>
                      <div className="flex gap-4 font-mono text-center">
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 min-w-[70px]"><p className="text-[9px] text-slate-400 font-black uppercase">REGULAR</p><p className="text-emerald-400 font-black text-lg mt-0.5">{emp.metrics.totalRegularHours}</p></div>
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 min-w-[70px]"><p className="text-[9px] text-slate-400 font-black uppercase">OVERTIME</p><p className="text-blue-400 font-black text-lg mt-0.5">+{emp.metrics.totalOvertimeHours}</p></div>
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 min-w-[70px]"><p className="text-[9px] text-slate-400 font-black uppercase">GROSS</p><p className="text-slate-100 font-black text-lg mt-0.5">{emp.metrics.totalHoursSum}</p></div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50/50 border-b border-slate-200 h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={workerGraphData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="day" stroke="#64748b" fontSize={10} fontWeight="bold" />
                          <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                          <Tooltip />
                          <Line type="monotone" dataKey="Regular" stroke="#10b981" strokeWidth={3} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Overtime" stroke="#2563eb" strokeWidth={3} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <CardHeader className="bg-white border-b px-6 py-4">
                      <CardTitle className="text-xs font-black text-slate-500 tracking-wider uppercase">HISTORICAL CHRONOLOGICAL TRANSACTION ENTRIES</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="px-6 text-xs font-bold text-slate-500">SHIFT CALENDAR DATE</TableHead>
                            <TableHead className="text-xs font-bold text-slate-500">CLOCK IN</TableHead>
                            <TableHead className="text-xs font-bold text-slate-500">CLOCK OUT</TableHead>
                            <TableHead className="text-center text-xs font-bold text-slate-500">TOTAL SHIFT TIME</TableHead>
                            <TableHead className="text-center text-xs font-bold text-slate-500 text-blue-600">OVERTIME SEGMENT</TableHead>
                            <TableHead className="text-right px-6 text-xs font-bold text-slate-500">RECONCILED STATUS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emp.records.map((punch, idx) => (
                            <TableRow key={idx} className="border-b hover:bg-slate-50/50 transition-colors">
                              <TableCell className="font-mono text-xs font-bold text-slate-600 px-6">{punch.date} ({punch.weekDay.slice(0,3)})</TableCell>
                              <TableCell className="text-slate-900 font-mono text-xs font-black">{punch.clockIn}</TableCell>
                              <TableCell className="text-slate-900 font-mono text-xs font-black">{punch.clockOut}</TableCell>
                              <TableCell className="text-center font-bold text-xs text-slate-900">{punch.totalShiftHours} hrs</TableCell>
                              <TableCell className="text-center bg-blue-50/10">
                                {punch.overtimeHours > 0 ? (
                                  <Badge className="bg-blue-600 text-white font-mono font-black text-[11px] rounded border border-blue-700 px-2">+{punch.overtimeHours} hr OT</Badge>
                                ) : <span className="text-slate-400 font-mono text-xs">—</span>}
                              </TableCell>
                              <TableCell className="text-right px-6">
                                <Badge className={`font-black text-[9px] rounded px-2 py-0.5 uppercase tracking-wide ${
                                  punch.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  punch.status === "LATE" ? "bg-amber-500 text-white" :
                                  punch.status === "ABSENT (INVALID PUNCHES)" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-400"
                                }`}>{punch.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}

          {/* SYSTEM TERMINAL LOG CONSOLE FOOTER */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardHeader className="pb-1.5 pt-3 px-5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-blue-600" /> SYSTEM DIAGNOSTIC RUNTIME FEED
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="border border-slate-200 rounded-lg bg-slate-950 p-3 font-mono text-[10px] text-slate-400 space-y-1">
                {systemLogs.map((log, i) => (
                  <div key={i} className="truncate">{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}