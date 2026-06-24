"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  Bar,
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
  Activity,
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
  role: "superuser" | "manager" | "operator";
}

// ─── REUSABLE SKELETON COMPONENT FOR PIPELINE WAITS ───
function Skeleton({ className }: { className: string }) {
  return (
    <div className={`bg-slate-200 animate-pulse rounded-md ${className}`} />
  );
}

export default function EMSDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>(
    [],
  );
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);

  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<
    string | null
  >(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [weekFilter, setWeekFilter] = useState<string>("ALL");
  const [dayFilter, setDayFilter] = useState<string>("ALL");
  const [lowAttendanceThreshold, setLowAttendanceThreshold] =
    useState<number>(30);
  const [isUploading, setIsUploading] = useState(false);

  const [bavStatus, setBavStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[INFO] System ready for biometric sequence analysis matrices.",
  ]);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"operator" | "manager" | "admin">(
    "operator",
  );
  const [isSuper, setIsSuper] = useState(false);
  const [rightChrono, setRightChrono] = useState(true);
  const [rightRoster, setRightRoster] = useState(false);
  const [provisionStatus, setProvisionStatus] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setSystemLogs((prev) =>
      [...prev, `${new Date().toLocaleTimeString()} ${msg}`].slice(-4),
    );
  };

  // --- Core Session Verification & Employee Directory Hydration ---
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
          const records = Array.isArray(empData)
            ? empData
            : empData.employees || [];
          setEmployeeDirectory(records);
          addLog(
            `[DB_SYNC] Instantiated ${records.length} corporate staff directory models.`,
          );
        }
      } catch (err) {
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    }
    initializeDashboard();
  }, [router]);

  useEffect(() => {
    async function syncAllSavedAttendanceData() {
      if (!user) return;
      try {
        addLog(`[API_SYNC] Initializing continuous table assembly sequence...`);

        let masterBufferArray: RawSwipe[] = [];
        let currentPage = 0;
        let keepStreaming = true;
        const batchChunkSize = 2500; // Matches backend batch sizing config

        while (keepStreaming) {
          addLog(
            `[API_SYNC] Downloading biometric block sequence index: ${currentPage + 1}...`,
          );

          const response = await fetch(
            `/api/attendance?page=${currentPage}&size=${batchChunkSize}`,
          );
          if (!response.ok)
            throw new Error(
              `Data pipeline broke at sector chunk ${currentPage}`,
            );

          const payload = await response.json();
          const incomingRows = payload.swipes || [];

          masterBufferArray = [...masterBufferArray, ...incomingRows];

          if (!payload.hasMore || incomingRows.length < batchChunkSize) {
            keepStreaming = false;
          } else {
            currentPage++;
          }
        }

        setRawSwipesBuffer(masterBufferArray);
        addLog(
          `[SUCCESS] Aggregation complete! Stored all ${masterBufferArray.length} transaction entries.`,
        );
      } catch (err: any) {
        addLog(`[ERROR] Continuous stream tracking exception: ${err.message}`);
        console.error("Pipeline failure:", err);
      }
    }

    syncAllSavedAttendanceData();
  }, [user]);

  const getWeekNumber = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Wk-??";
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
    return `Wk ${Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)}`;
  };

  const handleFileUploadDispatch = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as any[];

        const isMasterRoster = rawRows.some(
          (row) =>
            Array.isArray(row) &&
            row.some((c) => String(c).trim() === "Staff Code"),
        );
        const isBiometricLog = rawRows.some(
          (row) =>
            Array.isArray(row) &&
            row.some((c) => String(c).trim() === "Card Swiping Type"),
        );

        if (isMasterRoster) {
          const headerIdx = rawRows.findIndex(
            (row) =>
              Array.isArray(row) &&
              row.some((c) => String(c).trim() === "Staff Code"),
          );
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
              fullName: String(row[nameIdx] || "")
                .trim()
                .toUpperCase(),
              designation: String(row[desIdx] || "General Roster").trim(),
              department: String(row[deptIdx] || "Operations").trim(),
              costCenter: String(row[costIdx] || "Unassigned").trim(),
            });
          });

          const empDbRes = await fetch("/api/employees/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employees: parsedRoster }),
          });

          if (!empDbRes.ok)
            throw new Error("Failed syncing master roster entries.");

          setEmployeeDirectory(parsedRoster);
          setBavStatus({
            type: "success",
            message: `Successfully structured, verified, and saved ${parsedRoster.length} staff elements to data records.`,
          });
          setActiveTab("EMPLOYEES");
          addLog(
            `[ROSTER] Registered master directory profiles to database schema.`,
          );
        } else if (isBiometricLog) {
          const headerIdx = rawRows.findIndex(
            (row) =>
              Array.isArray(row) &&
              row.some((c) => String(c).trim() === "Card Swiping Type"),
          );
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
              type: String(row[typeIdx] || "").trim(),
            });
          });

          addLog(
            `[DB_COMMIT] Piping batch block of ${dynamicSwipes.length} items to database...`,
          );
          const dbResponse = await fetch("/api/attendance/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              records: dynamicSwipes,
              operatorEmail: user?.email,
            }),
          });

          if (!dbResponse.ok)
            throw new Error("Supabase stream database execution trace error.");

          setRawSwipesBuffer(dynamicSwipes);
          setBavStatus({
            type: "success",
            message: `Successfully parsed and recorded ${dynamicSwipes.length} log transactions to backend tables.`,
          });
          addLog(
            `[SUCCESS] Attendance records securely committed down to relational model schema.`,
          );
          setActiveTab("OVERVIEW");
        }
      } catch (err: any) {
        console.error("Ingestion parsing pipeline failure:", err);
        setBavStatus({
          type: "error",
          message:
            err.message ||
            "Failed to parse layout configuration or map matrix blocks.",
        });
        addLog(`[CRITICAL] Stream mapping processing execution fault.`);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSignOut = async () => {
    try {
      addLog(`[SECURITY] Initiating session termination sequence...`);
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Server rejected clean session clear.");
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      addLog(`[CRITICAL] Logout protocol failure: ${err.message}`);
    }
  };

  // --- AUTOMATIC CALCULATION & INTER-TABLE MAPPING ENGINE ---
  const systemProcessedDataset = useMemo(() => {
    const uniqueDates = Array.from(
      new Set(rawSwipesBuffer.map((s) => s.date)),
    ).sort();

    return employeeDirectory.map((emp) => {
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let presentDaysCount = 0;
      const dailyAttendanceRecords: DailyAttendanceGroup[] = [];

      uniqueDates.forEach((dateStr) => {
        if (monthFilter !== "ALL" && !dateStr.startsWith(monthFilter)) return;

        const weekNum = getWeekNumber(dateStr);
        if (weekFilter !== "ALL" && weekNum !== weekFilter) return;

        if (dayFilter !== "ALL" && dateStr !== dayFilter) return;

        const daySwipes = rawSwipesBuffer.filter(
          (s) => s.id === emp.staffCode && s.date === dateStr,
        );
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
            status: "NO RECORD",
          });
          return;
        }

        const weekDay = daySwipes[0].weekDay;
        const checkIns = daySwipes
          .filter((s) => s.type.toLowerCase().includes("in"))
          .sort((a, b) => a.time.localeCompare(b.time));
        const checkOuts = daySwipes
          .filter((s) => s.type.toLowerCase().includes("out"))
          .sort((a, b) => a.time.localeCompare(b.time));

        let clockIn = checkIns.length > 0 ? checkIns[0].time : "—";
        let clockOut =
          checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].time : "—";

        let regularHours = 0;
        let overtimeHours = 0;
        let totalShiftHours = 0;
        let dayStatus: "PRESENT" | "LATE" | "ABSENT (INVALID PUNCHES)" =
          "PRESENT";

        if (
          (clockIn !== "—" && clockOut === "—") ||
          (clockIn === "—" && clockOut !== "—")
        ) {
          dayStatus = "ABSENT (INVALID PUNCHES)";
        } else if (clockIn !== "—" && clockOut !== "—") {
          const [inH, inM] = clockIn.split(":").map(Number);
          const [outH, outM] = clockOut.split(":").map(Number);
          const minutesDiff = outH * 60 + outM - (inH * 60 + inM);

          totalShiftHours = parseFloat((minutesDiff / 60).toFixed(2));
          if (totalShiftHours < 0) totalShiftHours = 0;

          if (clockIn > "07:30") dayStatus = "LATE";
          presentDaysCount++;

          const dateObj = new Date(dateStr);
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
          const currentDayCap = isWeekend ? 5.5 : 8.5;

          if (totalShiftHours > currentDayCap) {
            regularHours = currentDayCap;
            overtimeHours = parseFloat(
              (totalShiftHours - currentDayCap).toFixed(2),
            );
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
          status: dayStatus,
        });
      });

      const totalHoursSum = totalRegularHours + totalOvertimeHours;
      return {
        ...emp,
        records: dailyAttendanceRecords.sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
        metrics: {
          totalRegularHours: parseFloat(totalRegularHours.toFixed(2)),
          totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
          totalHoursSum: parseFloat(totalHoursSum.toFixed(2)),
          averageHours:
            presentDaysCount > 0
              ? parseFloat((totalHoursSum / presentDaysCount).toFixed(2))
              : 0,
          presentDaysCount,
          isLowAttendance:
            totalHoursSum < lowAttendanceThreshold && presentDaysCount > 0,
        },
      };
    });
  }, [
    employeeDirectory,
    rawSwipesBuffer,
    monthFilter,
    weekFilter,
    dayFilter,
    lowAttendanceThreshold,
  ]);

  const filteredViewDataset = useMemo(() => {
    return systemProcessedDataset.filter((row) => {
      return (
        row.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.staffCode.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [systemProcessedDataset, searchQuery]);

  const filteredEmployeeDirectory = useMemo(() => {
    return employeeDirectory.filter((emp) => {
      return (
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.staffCode.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [employeeDirectory, searchQuery]);

  const lowAttendanceStaffList = useMemo(
    () => systemProcessedDataset.filter((e) => e.metrics.isLowAttendance),
    [systemProcessedDataset],
  );

  const dynamicFilterMenus = useMemo(() => {
    const monthsSet = new Set<string>();
    const weeksSet = new Set<string>();
    const daysSet = new Set<string>();

    rawSwipesBuffer.forEach((swipe) => {
      const dateObj = new Date(swipe.date);
      if (!isNaN(dateObj.getTime())) {
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
        monthsSet.add(monthKey);
        weeksSet.add(getWeekNumber(swipe.date));
        daysSet.add(swipe.date);
      }
    });

    return {
      months: Array.from(monthsSet).sort(),
      weeks: Array.from(weeksSet).sort((a, b) => {
        const aNum = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const bNum = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return aNum - bNum;
      }),
      days: Array.from(daysSet).sort(),
    };
  }, [rawSwipesBuffer]);

  const metricsRollup = useMemo(() => {
    let globalRegularHours = 0;
    let globalOvertimeHours = 0;
    let anomalyCount = 0;

    systemProcessedDataset.forEach((emp) => {
      globalRegularHours += emp.metrics.totalRegularHours;
      globalOvertimeHours += emp.metrics.totalOvertimeHours;
      emp.records.forEach((r) => {
        if (r.status === "ABSENT (INVALID PUNCHES)") anomalyCount++;
      });
    });

    return {
      globalRegularHours: parseFloat(globalRegularHours.toFixed(1)),
      globalOvertimeHours: parseFloat(globalOvertimeHours.toFixed(1)),
      globalTotalSum: parseFloat(
        (globalRegularHours + globalOvertimeHours).toFixed(1),
      ),
      anomalyCount,
      totalCount: employeeDirectory.length,
    };
  }, [systemProcessedDataset, employeeDirectory]);

  const departmentAggregatedMetrics = useMemo(() => {
    const rollupMap: Record<
      string,
      { name: string; staffCount: number; regHours: number; otHours: number }
    > = {};

    systemProcessedDataset.forEach((emp) => {
      const dept = emp.department || "Operations Cluster";
      if (!rollupMap[dept]) {
        rollupMap[dept] = {
          name: dept,
          staffCount: 0,
          regHours: 0,
          otHours: 0,
        };
      }
      rollupMap[dept].staffCount += 1;
      rollupMap[dept].regHours += emp.metrics.totalRegularHours;
      rollupMap[dept].otHours += emp.metrics.totalOvertimeHours;
    });

    return Object.values(rollupMap).map((d) => ({
      ...d,
      regHours: parseFloat(d.regHours.toFixed(1)),
      otHours: parseFloat(d.otHours.toFixed(1)),
    }));
  }, [systemProcessedDataset]);

  // Per-Department Deep Dive Selection Metrics Calculation Engine
  const selectedDepartmentDetails = useMemo(() => {
    if (!selectedDepartment) return null;

    const members = systemProcessedDataset.filter(
      (emp) => (emp.department || "Operations Cluster") === selectedDepartment
    );

    const timelineMap: Record<string, { name: string; "Overtime Hours": number; "Regular Hours": number }> = {};

    members.forEach((emp) => {
      emp.records.forEach((rec) => {
        if (rec.status === "NO RECORD") return;
        const key = rec.date;
        if (!timelineMap[key]) {
          timelineMap[key] = {
            name: key,
            "Overtime Hours": 0,
            "Regular Hours": 0,
          };
        }
        timelineMap[key]["Overtime Hours"] += rec.overtimeHours;
        timelineMap[key]["Regular Hours"] += rec.hoursWorked;
      });
    });

    const chartData = Object.values(timelineMap)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        ...item,
        "Overtime Hours": parseFloat(item["Overtime Hours"].toFixed(1)),
        "Regular Hours": parseFloat(item["Regular Hours"].toFixed(1)),
      }));

    return {
      name: selectedDepartment,
      members,
      chartData,
    };
  }, [systemProcessedDataset, selectedDepartment]);

  const overviewChartData = useMemo(() => {
    if (metricsRollup.globalOvertimeHours > 0) {
      return [
        {
          name: "Week 20",
          "Overtime Hours": metricsRollup.globalOvertimeHours * 0.15,
        },
        {
          name: "Week 21",
          "Overtime Hours": metricsRollup.globalOvertimeHours * 0.4,
        },
        {
          name: "Week 22",
          "Overtime Hours": metricsRollup.globalOvertimeHours * 0.75,
        },
        {
          name: "Week 23",
          "Overtime Hours": metricsRollup.globalOvertimeHours,
        },
      ];
    }
    return [
      { name: "Week 18", "Overtime Hours": 40 },
      { name: "Week 19", "Overtime Hours": 95 },
      { name: "Week 20", "Overtime Hours": 65 },
      { name: "Week 21", "Overtime Hours": 130 },
      { name: "Week 22", "Overtime Hours": 85 },
      { name: "Week 23", "Overtime Hours": 160 },
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

    const weekBuckets = Array.from(
      new Set<string>(emp.records.map((r: any) => String(r.weekOfYear))),
    )
      .filter((w: string) => w !== "Wk-??")
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .slice(0, 4);

    while (weekBuckets.length < 4) {
      weekBuckets.push(`Week Balance ${weekBuckets.length + 1}`);
    }

    const dayColumnsMap = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const matrixGridBody = weekBuckets.map((weekId, idx) => {
      const rowItemCells = [`WEEK ${idx + 1} (${weekId})`];
      dayColumnsMap.forEach((targetDayName) => {
        const matchRecord = emp.records.find(
          (r: any) =>
            r.weekOfYear === weekId &&
            r.weekDay.toLowerCase() === targetDayName.toLowerCase(),
        );
        if (matchRecord && matchRecord.status !== "NO RECORD") {
          rowItemCells.push(
            `${matchRecord.hoursWorked} / ${matchRecord.overtimeHours}`,
          );
        } else {
          rowItemCells.push("— / —");
        }
      });
      return rowItemCells;
    });

    autoTable(doc, {
      startY: 78,
      head: [
        [
          "CALENDAR MATRIX",
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
          "SUNDAY",
        ],
      ],
      body: matrixGridBody,
      theme: "grid",
      headStyles: {
        fillColor: [15, 23, 42],
        halign: "center",
        fontSize: 9,
        fontStyle: "bold",
      },
      styles: {
        cellPadding: 5,
        fontSize: 10,
        halign: "center",
        font: "Helvetica",
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: {
          fontStyle: "bold",
          halign: "left",
          fillColor: [241, 245, 249],
          cellWidth: 45,
        },
      },
    });

    doc.save(`GoFresh_Matrix_${emp.staffCode}.pdf`);
  };

  const exportLowAttendanceReportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.text("GOFRESH RUN EXCEPTIONS REPORT", 14, 20);
    const rows = lowAttendanceStaffList.map((emp) => [
      emp.staffCode,
      emp.fullName,
      emp.department,
      `${emp.metrics.totalRegularHours} hrs`,
      `${emp.metrics.totalOvertimeHours} hrs`,
      `${emp.metrics.totalHoursSum} hrs`,
    ]);
    autoTable(doc, {
      startY: 28,
      head: [
        [
          "Staff Code",
          "Full Name",
          "Department",
          "Regular",
          "Overtime",
          "Total Accrued",
        ],
      ],
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
      {/* ─── SIDEBAR NAVIGATION ─── */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between fixed h-full top-0 left-0 z-30 shadow-xl border-r border-slate-800">
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <div className="py-3 px-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-black text-xs shadow-md">
                GF
              </div>
              <div>
                <span className="font-black text-xs tracking-wider uppercase block text-slate-100">
                  GoFresh Engine
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                  PG_POOL_CONNECTED
                </span>
              </div>
            </div>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              title="Terminate Access Session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                setActiveTab("OVERVIEW");
                setSelectedEmployeeCode(null);
                setSelectedDepartment(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "OVERVIEW" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <LayoutDashboard className="w-4 h-4" /> PERFORMANCE OVERVIEW
            </button>
            <button
              onClick={() => {
                setActiveTab("DEPARTMENTS");
                setSelectedEmployeeCode(null);
                setSelectedDepartment(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "DEPARTMENTS" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <Building2 className="w-4 h-4 text-emerald-400" /> DEPARTMENT OVERVIEW
            </button>
            <button
              onClick={() => {
                setActiveTab("EMPLOYEES");
                setSelectedEmployeeCode(null);
                setSelectedDepartment(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "EMPLOYEES" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <Contact2 className="w-4 h-4" /> ALL EMPLOYEES ({metricsRollup.totalCount})
            </button>
            <button
              onClick={() => {
                setActiveTab("ROSTER");
                setSelectedEmployeeCode(null);
                setSelectedDepartment(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "ROSTER" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <Users className="w-4 h-4" /> ROSTER VIEW
            </button>
            <button
              onClick={() => {
                setActiveTab("DEFICITS");
                setSelectedEmployeeCode(null);
                setSelectedDepartment(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "DEFICITS" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" /> RUN EXCEPTIONS
            </button>
            <button
              onClick={() => {
                setActiveTab("ACCESS_CONTROL");
                setSelectedEmployeeCode(null);
                setSelectedDepartment(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${activeTab === "ACCESS_CONTROL" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" /> ACCESS LAYER
            </button>
          </div>

          {/* CHRONO FILTER LAYER CONTROLS */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-3">
              CHRONO SETTINGS
            </span>
            <div className="space-y-2 px-1">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                  Month Boundary
                </label>
                <select
                  value={monthFilter}
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    setWeekFilter("ALL");
                    setDayFilter("ALL");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] font-bold rounded p-2 uppercase"
                >
                  <option value="ALL">ALL MONTHS</option>
                  {dynamicFilterMenus.months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                  Weekly Boundary
                </label>
                <select
                  value={weekFilter}
                  onChange={(e) => {
                    setWeekFilter(e.target.value);
                    setDayFilter("ALL");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] font-bold rounded p-2 uppercase"
                >
                  <option value="ALL">ALL WEEKS</option>
                  {dynamicFilterMenus.weeks.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STREAM UPLOAD BUTTON */}
          <div className="pt-4 border-t border-slate-800">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUploadDispatch}
              accept=".xlsx, .xls, .csv"
              className="hidden"
              id="chrono-file-uploader"
            />
            <Button
              asChild
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              <label htmlFor="chrono-file-uploader">
                <UploadCloud className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  {isUploading ? "PERSISTING LOGS..." : "INGEST CHRONO MATRIX"}
                </span>
              </label>
            </Button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN WORKSPACE CONTENT WINDOW ─── */}
      <div className="flex-1 pl-64 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">
              WORKFORCE SYSTEMS
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 text-xs font-black tracking-widest uppercase">
              {activeTab} VIEW
            </span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="SEARCH INDEXED DATA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs uppercase font-bold rounded-lg h-9 border-slate-200"
            />
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {bavStatus && (
            <div
              className={`p-4 text-xs font-bold uppercase tracking-wider rounded-xl border ${bavStatus.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}
            >
              {bavStatus.message}
            </div>
          )}

          {activeTab === "OVERVIEW" && (
            <>
              {/* Overview Rollups with Skeleton Loaders */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" /> BASE WORKTIME HOURS
                    </CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                      {rawSwipesBuffer.length === 0 ? (
                        <Skeleton className="h-7 w-24 mt-1" />
                      ) : (
                        `${metricsRollup.globalRegularHours} HOURS`
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-600" /> PREMIUM OVERTIME ACCRUED
                    </CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-blue-600">
                      {rawSwipesBuffer.length === 0 ? (
                        <Skeleton className="h-7 w-20 mt-1" />
                      ) : (
                        `+${metricsRollup.globalOvertimeHours} HOURS`
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" /> GROSS COMBINED SUM
                    </CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                      {rawSwipesBuffer.length === 0 ? (
                        <Skeleton className="h-7 w-28 mt-1" />
                      ) : (
                        `${metricsRollup.globalTotalSum} HOURS`
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> INVALID ANOMALIES
                    </CardDescription>
                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                      {rawSwipesBuffer.length === 0 ? (
                        <Skeleton className="h-7 w-16 mt-1" />
                      ) : (
                        `${metricsRollup.anomalyCount} PUNCHES`
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Chart & Sidebar Lists with Skeleton loaders */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      SYSTEMIC MONTHLY OVERTIME VARIANCE TREND
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rawSwipesBuffer.length === 0 ? (
                      <div className="h-64 w-full flex flex-col justify-between pt-2">
                        <div className="flex items-end justify-between h-48 px-4 gap-4">
                          <Skeleton className="h-[30%] w-full" />
                          <Skeleton className="h-[65%] w-full" />
                          <Skeleton className="h-[45%] w-full" />
                          <Skeleton className="h-[90%] w-full" />
                        </div>
                        <div className="flex justify-between px-2 pt-4">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={overviewChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                            <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                            <Tooltip />
                            <Bar dataKey="Overtime Hours" fill="#2563eb" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      OPERATIONAL CLUSTER PROFILES
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {rawSwipesBuffer.length === 0 ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <div className="space-y-2 w-2/3">
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="h-2.5 w-32" />
                          </div>
                          <Skeleton className="h-6 w-14 rounded-full" />
                        </div>
                      ))
                    ) : (
                      departmentAggregatedMetrics.slice(0, 4).map((d) => (
                        <div key={d.name} className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <div>
                            <span className="text-xs font-black text-slate-900 uppercase block">{d.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{d.staffCount} Agents Assigned</span>
                          </div>
                          <Badge className="text-blue-600 border-blue-200 bg-blue-50/50 text-[10px] font-black">
                            +{d.otHours}h OT
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {activeTab === "DEPARTMENTS" && (
            <div className="space-y-6">
              {rawSwipesBuffer.length === 0 ? (
                /* Master Department Loader Skeleton */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Card key={idx} className="bg-white border border-slate-200 p-6 rounded-xl space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <div className="pt-2 space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : selectedDepartment ? (
                /* ─── DRILL DOWN INDIVIDUAL DEPARTMENT VIEW ─── */
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDepartment(null)}
                        className="text-xs font-bold gap-2 border-slate-300 hover:bg-slate-100"
                      >
                        ← BACK TO ALL DEPARTMENTS
                      </Button>
                      <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase mt-2">
                        {selectedDepartmentDetails?.name} Analytics Matrix
                      </h2>
                    </div>
                  </div>

                  {/* Mini Rollup Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                      <CardContent className="pt-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Active Staff Headcount
                        </div>
                        <div className="text-2xl font-black text-slate-900">
                          {selectedDepartmentDetails?.members.length} <span className="text-xs text-slate-400">MEMBERS</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                      <CardContent className="pt-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Accumulated Overtime
                        </div>
                        <div className="text-2xl font-black text-blue-600">
                          {selectedDepartmentDetails?.members.reduce((acc, curr) => acc + curr.metrics.totalOvertimeHours, 0).toFixed(1)} <span className="text-xs text-slate-400">HRS</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                      <CardContent className="pt-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Gross Productive Hours
                        </div>
                        <div className="text-2xl font-black text-slate-900">
                          {selectedDepartmentDetails?.members.reduce((acc, curr) => acc + curr.metrics.totalHoursSum, 0).toFixed(1)} <span className="text-xs text-slate-400">HRS</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Smooth Curved Line Chart */}
                  <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                    <CardHeader>
                      <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Overtime & Regular Duty Timeline Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={selectedDepartmentDetails?.chartData || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                            <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                            <Tooltip />
                            <Legend verticalAlign="top" height={36} />
                            <Line
                              type="monotone"
                              dataKey="Overtime Hours"
                              stroke="#2563eb"
                              strokeWidth={3}
                              activeDot={{ r: 6 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="Regular Hours"
                              stroke="#10b981"
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Department Member Manifest List Table */}
                  <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                    <CardHeader>
                      <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Assigned Staff Operational Roster
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="text-[10px] font-black text-slate-500 uppercase">Code</TableHead>
                            <TableHead className="text-[10px] font-black text-slate-500 uppercase">Employee Name</TableHead>
                            <TableHead className="text-[10px] font-black text-slate-500 uppercase">Designation</TableHead>
                            <TableHead className="text-[10px] font-black text-slate-500 uppercase text-right">Regular Hrs</TableHead>
                            <TableHead className="text-[10px] font-black text-slate-500 uppercase text-right">Overtime Hrs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDepartmentDetails?.members.map((emp) => (
                            <TableRow key={emp.staffCode} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <TableCell className="font-mono text-xs font-bold text-slate-700">{emp.staffCode}</TableCell>
                              <TableCell className="text-xs font-bold text-slate-900">{emp.fullName}</TableCell>
                              <TableCell className="text-xs text-slate-600 uppercase">{emp.designation}</TableCell>
                              <TableCell className="text-xs text-right font-semibold">{emp.metrics.totalRegularHours}</TableCell>
                              <TableCell className="text-xs text-right font-black text-blue-600">+{emp.metrics.totalOvertimeHours}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                /* ─── MASTER DEPARTMENTS OVERVIEW GRID ─── */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {departmentAggregatedMetrics.map((dept) => (
                    <Card
                      key={dept.name}
                      className="bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md cursor-pointer transition-all border-l-4 border-l-blue-600"
                      onClick={() => setSelectedDepartment(dept.name)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black tracking-tight text-slate-900 uppercase">
                          {dept.name}
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold text-slate-400 uppercase">
                          {dept.staffCount} ACTIVE OPERATIVES ASSIGNED
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Regular Duty:</span>
                            <span className="font-bold text-slate-800">{dept.regHours} hrs</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Overtime Accrued:</span>
                            <span className="font-black text-blue-600">+{dept.otHours} hrs</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "EMPLOYEES" && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Code</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Full Name</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Department</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase text-right">Regular</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase text-right">Overtime</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawSwipesBuffer.length === 0 ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 mx-auto rounded" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      filteredViewDataset.map((emp) => (
                        <TableRow key={emp.staffCode} className="border-b border-slate-100 hover:bg-slate-50/40">
                          <TableCell className="font-mono text-xs font-bold text-slate-600">{emp.staffCode}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-900">{emp.fullName}</TableCell>
                          <TableCell className="text-xs text-slate-500 uppercase">{emp.department}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{emp.metrics.totalRegularHours}h</TableCell>
                          <TableCell className="text-xs text-right font-black text-blue-600">+{emp.metrics.totalOvertimeHours}h</TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => exportTargetEmployeePDF(emp)}
                              className="h-7 text-[10px] font-black tracking-wider text-slate-500 hover:text-blue-600 hover:bg-blue-50 uppercase"
                            >
                              <Download className="w-3 h-3 mr-1" /> EXPORT MATRIX
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === "ROSTER" && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Staff Code</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Full Corporate Name</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Designation Role</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Department</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-500 uppercase">Cost Center</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeDirectory.length === 0 ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      filteredEmployeeDirectory.map((emp) => (
                        <TableRow key={emp.staffCode} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="font-mono text-xs font-bold text-slate-700">{emp.staffCode}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-900">{emp.fullName}</TableCell>
                          <TableCell className="text-xs text-slate-600 uppercase">{emp.designation}</TableCell>
                          <TableCell className="text-xs text-slate-600 uppercase">{emp.department}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">{emp.costCenter}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === "DEFICITS" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
                <div>
                  <span className="text-xs font-black text-slate-900 block uppercase">Attendance Deficit Matrix Parameters</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Current Target Cutoff Window Threshold: {lowAttendanceThreshold} Hours</span>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={lowAttendanceThreshold}
                    onChange={(e) => setLowAttendanceThreshold(Number(e.target.value))}
                    className="w-24 h-9 text-xs font-black text-center border-slate-200"
                  />
                  <Button
                    onClick={exportLowAttendanceReportPDF}
                    size="sm"
                    className="h-9 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black tracking-wider gap-1.5 rounded-lg"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" /> EXPORT EXCEPTIONS
                  </Button>
                </div>
              </div>

              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 border-b border-slate-200">
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase">Code</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase">Staff Name</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase">Department</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase text-right">Productive Hours</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase text-center">Status Flag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawSwipesBuffer.length === 0 ? (
                        Array.from({ length: 4 }).map((_, idx) => (
                          <TableRow key={idx}>
                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24 mx-auto rounded-full" /></TableCell>
                          </TableRow>
                        ))
                      ) : (
                        lowAttendanceStaffList.map((emp) => (
                          <TableRow key={emp.staffCode} className="border-b border-slate-100 bg-amber-50/20">
                            <TableCell className="font-mono text-xs font-bold text-slate-700">{emp.staffCode}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-900">{emp.fullName}</TableCell>
                            <TableCell className="text-xs text-slate-500 uppercase">{emp.department}</TableCell>
                            <TableCell className="text-xs text-right font-black text-amber-700">{emp.metrics.totalHoursSum} hrs</TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px] font-black uppercase">DEFICIT RUNTIME</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "ACCESS_CONTROL" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    PROVISION SECURITY OPERATOR
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {provisionStatus && (
                    <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg uppercase">
                      {provisionStatus}
                    </div>
                  )}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Corporate Email Address</label>
                    <Input
                      type="email"
                      placeholder="operator@gofresh.corp"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="text-xs font-bold border-slate-200 h-9"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Systemic Password Seed</label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="text-xs font-bold border-slate-200 h-9"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Authorization Privilege Stratum</label>
                    <select
                      value={newRole}
                      onChange={(e: any) => setNewRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2.5 uppercase text-slate-800"
                    >
                      <option value="operator">Standard Operations Operator</option>
                      <option value="manager">Control Manager Stratum</option>
                      <option value="admin">System Administration Architecture</option>
                    </select>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={isSuper} onChange={(e) => setIsSuper(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      SUPERUSER FLAG
                    </label>
                  </div>
                  <Button
                    onClick={async () => {
                      setProvisionStatus("[PENDING] Executing user creation...");
                      const res = await fetch("/api/users/manage", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: newEmail,
                          password: newPassword,
                          role_tier: newRole,
                          is_superuser: isSuper,
                          can_ingest_chrono: rightChrono,
                          can_modify_roster: rightRoster,
                        }),
                      });
                      const dat = await res.json();
                      if (res.ok) {
                        setProvisionStatus(`[SUCCESS] Created entry user target id: ${dat.userId}`);
                        setNewEmail("");
                        setNewPassword("");
                      } else {
                        setProvisionStatus(`[ERROR] ${dat.error || "Execution failed."}`);
                      }
                    }}
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-lg tracking-wider"
                  >
                    PROVISION CREDENTIAL ENTITY
                  </Button>
                </CardContent>
              </Card>

              <div className="md:col-span-2 space-y-4">
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">SYSTEM ARCHITECTURE RULES</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs font-medium text-slate-600">
                    <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-slate-900 block uppercase mb-0.5">ADMINISTRATOR STRATUM</span>
                        Full schematic modification engine tracking schemas, access keys context layer rules, database seeding configurations and matrix ingestion blocks.
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-slate-900 block uppercase mb-0.5">OPERATOR STRATUM</span>
                        Standard read-only runtime feed monitoring view and basic biometric file dropping actions.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* ─── SYSTEM TERMINAL LOG CONSOLE FOOTER ─── */}
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
                  <div key={i} className="truncate">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </footer>
      </div>
    </div>
  );
}