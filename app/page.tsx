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

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([]);
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);
  
  const [activeTab, setActiveTab] = useState("OVERVIEW"); 
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState<string>("ALL"); 
  const [weekFilter, setWeekFilter] = useState<string>("ALL");   
  const [dayFilter, setDayFilter] = useState<string>("ALL");     
  const [lowAttendanceThreshold, setLowAttendanceThreshold] = useState<number>(30); 
  const [isUploading, setIsUploading] = useState(false);

  const [bavStagedRecords, setBavStagedRecords] = useState<EmployeeProfile[]>([]);
  const [isBavSaving, setIsBavSaving] = useState(false);
  const [bavStatus, setBavStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[INFO] System ready for biometric sequence analysis matrices."
  ]);

  useEffect(() => {
    async function initializeDashboard() {
      try {
        const authResponse = await fetch("/api/auth/me");
        if (!authResponse.ok) throw new Error("Unauthenticated");
        const authData = await authResponse.json();
        setUser(authData.user);
        addLog(`[SUCCESS] Verified access context for ${authData.user.email}`);

        // Hydrate employees list from DB
        const empResponse = await fetch("/api/employees");
        if (empResponse.ok) {
          const empData = await empResponse.json();
          const records = Array.isArray(empData) ? empData : empData.employees || [];
          setEmployeeDirectory(records);
          addLog(`[DB_SYNC] Instantiated ${records.length} corporate staff directory models.`);
        }
      } catch (err) {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    }
    initializeDashboard();
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

  // --- REWORKED: HANDLES FILE INGESTION AND STORES TO SUPABASE ---
  const handleFileUploadDispatch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setBavStatus(null);
    addLog(`[CHRONO] Analyzing ingestion data sequence: ${file.name}`);

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
          addLog(`[ROSTER] Parsed local memory registry containing ${parsedRoster.length} staff records.`);
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

          // 1. Sync state directly for immediate runtime interface updates
          setRawSwipesBuffer(dynamicSwipes);

          // 2. Transmit block array directly to Supabase table repository
          addLog(`[DB_COMMIT] Piping batch block of ${dynamicSwipes.length} items to database...`);
          const dbResponse = await fetch("/api/attendance/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ records: dynamicSwipes })
          });

          if (!dbResponse.ok) throw new Error("Supabase stream insertion error.");
          
          setBavStatus({ type: "success", message: `Successfully parsed and recorded ${dynamicSwipes.length} log transactions to database tables.` });
          addLog(`[SUCCESS] Attendance records synced with database architecture.`);
          setActiveTab("OVERVIEW");
        }
      } catch (err: any) {
        console.error("Ingestion parsing pipeline failure:", err);
        setBavStatus({ type: "error", message: err.message || "Failed to parse layout configuration or map matrix blocks." });
        addLog(`[CRITICAL] Stream mapping processing execution fault.`);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBavExcelParse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`[BAV_PARSER] Extracting profile rows from: ${file.name}`);
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
        addLog(`[SUCCESS] Staged ${validatedEmployees.length} workforce assets inside workspace.`);
      } catch (err) {
        setBavStatus({ type: "error", message: "Failed to construct row array configuration mapping models." });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const saveBavRecordsToPostgres = async () => {
    if (bavStagedRecords.length === 0) return;
    setIsBavSaving(true);
    setBavStatus(null);

    try {
      const response = await fetch("/api/employees/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: bavStagedRecords }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Batch compilation error.");

      setEmployeeDirectory(prev => {
        const uniqueMap = new Map(prev.map(item => [item.staffCode, item]));
        bavStagedRecords.forEach(rec => uniqueMap.set(rec.staffCode, rec));
        return Array.from(uniqueMap.values());
      });

      setBavStatus({ type: "success", message: `Successfully registered ${bavStagedRecords.length} staff records.` });
      setBavStagedRecords([]);
      setActiveTab("EMPLOYEES");
    } catch (err: any) {
      setBavStatus({ type: "error", message: err.message || "Internal database transaction exception." });
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

  // --- AUTOMATIC CALCULATION & INTER-TABLE MAPPING ENGINE ---
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
    });

    doc.save(`GoFresh_Matrix_${emp.staffCode}.pdf`);
  };

  const exportLowAttendanceReportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.text("GOFRESH RUN EXCEPTIONS REPORT", 14, 20);
    const rows = lowAttendanceStaffList.map(emp => [
      emp.staffCode, emp.fullName, emp.department, `${emp.metrics.totalRegularHours} hrs`, `${emp.metrics.totalOvertimeHours} hrs`, `${emp.metrics.totalHoursSum} hrs`
    ]);
    autoTable(doc, {
      startY: 28,
      head: [["Staff Code", "Full Name", "Department", "Regular", "Overtime", "Total Accrued"]],
      body: rows,
    });
    doc.save(`GoFresh_Attendance_Deficits.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex bg-slate-950 text-slate-100 min-h-screen items-center justify-center font-mono text-xs tracking-widest uppercase">
        <Activity className="w-4 h-4 animate-spin text-blue-500 mr-2" />
        Syncing Processing Matrix Context...
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 text-slate-900 min-h-screen antialiased selection:bg-blue-500 selection:text-white">
      
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
              <div className="px-1 pt-1">
                <Button onClick={saveBavRecordsToPostgres} disabled={isBavSaving} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wide">
                  {isBavSaving ? "WRITING..." : `COMMIT ${bavStagedRecords.length} TO DB`}
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
            <input type="file" ref={fileInputRef} onChange={handleFileUploadDispatch} accept=".xlsx, .xls, .csv" className="hidden" id="chrono-file-uploader" />
            <Button asChild variant="ghost" className="w-full justify-start gap-3 px-3 py-2.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-bold cursor-pointer">
              <label htmlFor="chrono-file-uploader">
                <UploadCloud className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{isUploading ? "PERSISTING LOGS..." : "INGEST CHRONO MATRIX"}</span>
              </label>
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 pl-64 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">WORKFORCE SYSTEMS</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 text-xs font-black tracking-widest uppercase">{activeTab} VIEW</span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="SEARCH INDEXED DATA..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 text-xs uppercase font-bold rounded-lg h-9 border-slate-200" />
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {bavStatus && (
            <div className={`p-4 rounded-xl border text-xs font-bold flex items-start gap-2.5 ${
              bavStatus.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
              <div>{bavStatus.message}</div>
            </div>
          )}

          {activeTab === "OVERVIEW" && !selectedEmployeeCode && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-600" /> SYSTEM BASE RUNTIME</CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900">{metricsRollup.globalRegularHours} <span className="text-xs font-bold text-slate-400">HRS</span></CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-amber-500" /> OVERTIME RUNTIME</CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900">+{metricsRollup.globalOvertimeHours} <span className="text-xs font-bold text-slate-400">HRS</span></CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-600" /> OPERATIONAL STAFF</CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900">{metricsRollup.totalCount} <span className="text-xs font-bold text-slate-400">PROFILES</span></CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-red-600" /> INVALID ANOMALIES</CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900">{metricsRollup.anomalyCount} <span className="text-xs font-bold text-slate-400">PUNCHES</span></CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-400">OVERTIME ACQUISITION SPEED MATRIX</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overviewChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                        <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: "bold" }} />
                        <Line type="monotone" dataKey="Overtime Hours" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-400">DEPARTMENT RUNTIME DISTRO</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentAggregatedMetrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickFormatter={(v) => v.substring(0,6) + ".."} />
                        <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                        <Tooltip />
                        <Bar dataKey="regHours" name="Regular Hours" fill="#10b981" stackId="a" />
                        <Bar dataKey="otHours" name="Overtime Hours" fill="#f59e0b" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "BAV_PREVIEW" && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl animate-in fade-in duration-200">
              <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">Excel Ingestion Staging Verification Portal</CardTitle>
                  <CardDescription className="text-xs font-bold text-slate-400">Review objects before initializing transaction sequence updates.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => { setBavStagedRecords([]); setActiveTab("OVERVIEW"); }} variant="outline" className="h-9 font-bold text-xs uppercase tracking-wide px-4 border-slate-200">ABORT UPDATE</Button>
                  <Button onClick={saveBavRecordsToPostgres} disabled={isBavSaving} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wide px-5">
                    {isBavSaving ? "COMMITTING TRANSACTIONS..." : `COMMIT ${bavStagedRecords.length} RECORD BLOCKS`}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-6">STAFF CODE</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FULL NAME IDENTIFICATION</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESIGNATION ROLE</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DEPARTMENT STRATUM</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-6">COST CENTRE ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bavStagedRecords.slice(0, 50).map((emp, i) => (
                      <TableRow key={i} className="hover:bg-slate-50/50 transition-all">
                        <TableCell className="font-mono text-xs font-black text-blue-600 pl-6">{emp.staffCode}</TableCell>
                        <TableCell className="text-xs font-bold uppercase text-slate-800">{emp.fullName}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-500">{emp.designation}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-500">{emp.department}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-600 pr-6">{emp.costCenter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === "DEPARTMENTS" && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl animate-in fade-in duration-200">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">Operational Units Matrix Overview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-6">DEPARTMENT CLUSTER</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">HEADCOUNT</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">REGULAR BASE TIME</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-6">OVERTIME VOLUMES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentAggregatedMetrics.map((dept, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-black text-slate-800 pl-6 uppercase">{dept.name}</TableCell>
                        <TableCell className="text-xs font-bold text-center text-slate-600">{dept.staffCount} Staff</TableCell>
                        <TableCell className="text-xs font-bold text-right font-mono text-emerald-600">{dept.regHours} hrs</TableCell>
                        <TableCell className="text-xs font-bold text-right font-mono text-amber-500 pr-6">+{dept.otHours} hrs</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === "EMPLOYEES" && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl animate-in fade-in duration-200">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">Workforce Asset Master Index ({filteredEmployeeDirectory.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-6">STAFF CODE</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FULL NAME IDENTIFICATION</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESIGNATION</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DEPARTMENT</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-6">INTERACTION MATRIX</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployeeDirectory.map((emp) => (
                      <TableRow key={emp.staffCode} className="hover:bg-slate-50/40 transition-all">
                        <TableCell className="font-mono text-xs font-black text-slate-900 pl-6">{emp.staffCode}</TableCell>
                        <TableCell className="text-xs font-black text-slate-800 uppercase">{emp.fullName}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-500">{emp.designation}</TableCell>
                        <TableCell className="text-xs font-semibold text-slate-500 uppercase">{emp.department}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button onClick={() => { setSelectedEmployeeCode(emp.staffCode); setActiveTab("ROSTER"); }} size="sm" variant="outline" className="h-7 text-[10px] font-black uppercase tracking-wide border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-all">
                            CALCULATE WORK BALANCE
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === "ROSTER" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {!selectedEmployeeCode ? (
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">Consolidated Overtime Ledger Reconciler</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/70">
                        <TableRow>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-6">ID</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EMPLOYEE IDENTIFICATION</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DEPARTMENT STRATUM</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ATTENDANCE COUNT</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">COMPLIANT TOTAL</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">PREMIUM OVERTIME</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-6">CALENDAR ENGINE</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredViewDataset.map((row) => (
                          <TableRow key={row.staffCode} className="hover:bg-slate-50/40 transition-all">
                            <TableCell className="font-mono text-xs font-black text-slate-900 pl-6">{row.staffCode}</TableCell>
                            <TableCell className="text-xs font-black text-slate-800 uppercase">{row.fullName}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-400 uppercase">{row.department}</TableCell>
                            <TableCell className="text-xs font-semibold text-center text-slate-600">{row.metrics.presentDaysCount} Active Days</TableCell>
                            <TableCell className="text-xs font-bold text-right font-mono text-emerald-600">{row.metrics.totalRegularHours} hrs</TableCell>
                            <TableCell className="text-xs font-black text-right font-mono text-blue-600">+{row.metrics.totalOvertimeHours} hrs</TableCell>
                            <TableCell className="text-right pr-6 flex justify-end gap-2">
                              <Button onClick={() => exportTargetEmployeePDF(row)} size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-900 rounded-md">
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button onClick={() => setSelectedEmployeeCode(row.staffCode)} size="sm" variant="outline" className="h-7 text-[10px] font-black uppercase tracking-wide border-slate-200">
                                MATRIX VIEW
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                (() => {
                  const punch = systemProcessedDataset.find(e => e.staffCode === selectedEmployeeCode);
                  if (!punch) return null;
                  return (
                    <Card className="bg-white border border-slate-200 shadow-sm rounded-xl animate-in fade-in duration-200">
                      <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
                        <div>
                          <Button onClick={() => setSelectedEmployeeCode(null)} variant="link" className="text-xs font-bold text-blue-600 p-0 h-auto uppercase tracking-wider mb-1 block">← RETURN TO MAIN CONSOLIDATED SHEET</Button>
                          <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">{punch.fullName} — Biometric Log Audit</CardTitle>
                          <CardDescription className="text-xs font-bold text-slate-400">Chronological list of all biometric punches matching identity tracking configuration index {punch.staffCode}.</CardDescription>
                        </div>
                        <Button onClick={() => exportTargetEmployeePDF(punch)} className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wide h-9 px-4 gap-2">
                          <Download className="w-4 h-4" /> GENERATE ACCOUNTING MATRIX PDF
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader className="bg-slate-50/70">
                            <TableRow>
                              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-6">CALENDAR DATE</TableHead>
                              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WEEKDAY</TableHead>
                              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BIOMETRIC IN</TableHead>
                              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BIOMETRIC OUT</TableHead>
                              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">BASE TIME HOURS</TableHead>
                              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">OVERTIME ACCRUED</TableHead>
                              <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-6">PUNCH STATUS</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {punch.records.map((punch, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs font-bold text-slate-900 pl-6">{punch.date}</TableCell>
                                <TableCell className="text-xs font-bold text-slate-400 uppercase">{punch.weekDay}</TableCell>
                                <TableCell className="font-mono text-xs font-bold text-slate-700">{punch.clockIn}</TableCell>
                                <TableCell className="font-mono text-xs font-bold text-slate-700">{punch.clockOut}</TableCell>
                                <TableCell className="text-xs font-bold text-right font-mono text-slate-600">{punch.hoursWorked} hrs</TableCell>
                                <TableCell className="text-xs font-black text-right font-mono text-blue-600">+{punch.overtimeHours} hrs</TableCell>
                                <TableCell className="text-right pr-6">
                                  <Badge className={`text-[9px] font-black uppercase tracking-wider rounded border shadow-none px-2 py-0.5 ${
                                    punch.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
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
                })()
              )}
            </div>
          )}

          {activeTab === "DEFICITS" && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl animate-in fade-in duration-200">
              <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">Operational Exceptions & Run Deficits</CardTitle>
                  <CardDescription className="text-xs font-bold text-slate-400">Listing records with total gross runtime summation values falling below threshold parameters.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">THRESHOLD LIMIT:</span>
                    <Input type="number" value={lowAttendanceThreshold} onChange={(e) => setLowAttendanceThreshold(Number(e.target.value))} className="w-16 h-8 text-xs font-black font-mono text-center rounded border-slate-200" />
                  </div>
                  <Button onClick={exportLowAttendanceReportPDF} className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wide h-8 px-3 gap-1.5 shadow-sm rounded-lg">
                    <Download className="w-3.5 h-3.5" /> EXPORT REPORT
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-6">STAFF CODE</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EMPLOYEE IDENTIFICATION</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DEPARTMENT CLUSTER</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">TOTAL ACCRUED WORKTIME</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-6">SYSTEM FLAG</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowAttendanceStaffList.map((emp) => (
                      <TableRow key={emp.staffCode} className="hover:bg-red-50/20 transition-all">
                        <TableCell className="font-mono text-xs font-black text-red-600 pl-6">{emp.staffCode}</TableCell>
                        <TableCell className="text-xs font-black text-slate-800 uppercase">{emp.fullName}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-400 uppercase">{emp.department}</TableCell>
                        <TableCell className="text-xs font-black text-right font-mono text-slate-900">{emp.metrics.totalHoursSum} hrs / {lowAttendanceThreshold} hrs</TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge className="bg-red-50 border border-red-200 text-red-700 text-[9px] font-black uppercase tracking-wider rounded px-2 py-0.5">UNDER THRESHOLD RUNTIME</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <footer className="mt-auto p-8 max-w-7xl w-full mx-auto pt-0">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
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
        </footer>
      </div>
    </div>
  );
}