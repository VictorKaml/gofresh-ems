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
  Search,
  UploadCloud,
  Users,
  LayoutDashboard,
  Clock,
  AlertTriangle,
  Contact2,
  Building2,
  CheckCircle2,
  Terminal,
  UserPlus,
  CalendarDays,
  Settings,
  Briefcase,
  UserCheck,
  UserX,
  History,
  FileText,
  Download,
  Loader2,
  BarChart3,
  Filter,
  LogOut,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AttendanceReportPage from "../overall/page";
import AttendanceDashboard from "../reports/page";

interface EmployeeProfile {
  staffCode: string;
  fullName: string;
  email: string;
  designation: string;
  department: string;
  costCenter: string;
  status: "Active" | "Inactive";
  workType: "In Office" | "Remote" | "Hybrid";
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
  status: "ON TIME" | "LATE" | "MISSED A CLOCK PUNCH" | "NO RECORD FOUND";
}

interface SessionUser {
  id: string;
  email: string;
  role: string;
}

function SkeletonBox({ className }: { className: string }) {
  return (
    <div className={`bg-slate-200 animate-pulse rounded-xl ${className}`} />
  );
}

export default function EMSDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [onsiteLiveCount, setOnsiteLiveCount] = useState<number>(0);

  const [reportDept, setReportDept] = useState<string>("ALL");
  const [reportCC, setReportCC] = useState<string>("ALL");

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string | null>(
    null,
  );
  const [rosterStatusTab, setRosterStatusTab] = useState<
    "ALL" | "ON_TIME" | "LATE" | "ABSENT"
  >("ALL");

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingData, setIsSyncingData] = useState(true);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>(
    [],
  );
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);

  // Place this inside your main EMSDashboard component function:
  const excelBulkInputRef = useRef<HTMLInputElement>(null);

  // Place this inside your main EMSDashboard component function:
  const [isBulkEmployeeUploading, setIsBulkEmployeeUploading] = useState(false);

  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [staffSubTab, setStaffSubTab] = useState("REGISTER");

  // System users state for the settings panel
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Existing state fields (Make sure these variables match what you use in your form)
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("operator");
  const [isSuper, setIsSuper] = useState(false);
  const [rightChrono, setRightChrono] = useState(false); // If referenced by your form
  const [rightRoster, setRightRoster] = useState(false); // If referenced by your form
  const [provisionStatus, setProvisionStatus] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [checklistSearchQuery, setChecklistSearchQuery] = useState("");
  const [savingChecklistCode, setSavingChecklistCode] = useState<string | null>(
    null,
  );
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [isUploading, setIsUploading] = useState(false);
  const [bavStatus, setBavStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [systemLogs, setSystemLogs] = useState<string[]>([
    "System is ready and running smoothly.",
  ]);

  // 📅 Range constraint bounds state layers
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Defaults dynamically to trailing 7-day view window
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffDesignation, setNewStaffDesignation] = useState("");
  const [newStaffDept, setNewStaffDept] = useState("Operations");
  const [newStaffCostCenter, setNewStaffCostCenter] = useState("Main Barn");
  const [newStaffWorkType, setNewStaffWorkType] = useState<
    "In Office" | "Remote" | "Hybrid"
  >("In Office");

  // Daily Checklist Workspace States
  const [checklistDept, setChecklistDept] = useState<string>("");
  const [checklistCostCenter, setChecklistCostCenter] = useState<string>("");
  const [isSubmittingManualAttendance, setIsSubmittingManualAttendance] =
    useState<string | null>(null);

  const [selectedMetricFilter, setSelectedMetricFilter] = useState<
    "ALL" | "ONSITE" | "ABSENT" | "ON_TIME" | "LATE"
  >("ALL");

  const addLog = (msg: string) => {
    setSystemLogs((prev) =>
      [...prev, `${new Date().toLocaleTimeString()} - ${msg}`].slice(-3),
    );
  };

  // Fetch system users from our API route
  const fetchSystemUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/system-users");
      const data = await res.json();
      if (data.success) {
        setSystemUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch system users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Trigger user fetch whenever the settings tab becomes active
  useEffect(() => {
    if (activeTab === "SETTINGS") {
      fetchSystemUsers();
    }
  }, [activeTab]);

  // Update User Role (PATCH)
  const handleUpdateUserRole = async (id: string, role: string) => {
    try {
      const res = await fetch("/api/system-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role_tier: role }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`Successfully updated system user role to ${role}`);
        fetchSystemUsers(); // Refresh the list
      } else {
        alert(data.error || "Failed to update role");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Revoke Access / Delete User (DELETE)
  const handleDeleteSystemUser = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently revoke system access for this user?",
      )
    )
      return;
    try {
      const res = await fetch(
        `/api/system-users?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (res.ok) {
        addLog("Revoked administrator/operator system access account.");
        fetchSystemUsers(); // Refresh the list
      } else {
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const targetDate = selectedDate || new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function fetchOnsiteCount() {
      try {
        // Pass the query parameter to your backend endpoint
        const response = await fetch(
          `/api/attendance/onsite?date=${encodeURIComponent(targetDate)}`,
        );

        if (response.ok) {
          const data = await response.json();
          // Map safely based on your endpoint API payload schema structure
          if (typeof data.count === "number") {
            setOnsiteLiveCount(data.count);
          } else if (typeof data.onsiteCount === "number") {
            setOnsiteLiveCount(data.onsiteCount);
          }
        }
      } catch (err) {
        console.error("Failed to sync onsite attendance counter metrics:", err);
      }
    }

    fetchOnsiteCount();

    // Auto-retrigger calculation counts every time the administrator flips dates on the dashboard
  }, [targetDate]);

  useEffect(() => {
    async function initializeDashboard() {
      try {
        const authResponse = await fetch("/api/auth/me");
        if (!authResponse.ok) throw new Error("Unauthenticated");
        const authData = await authResponse.json();
        setUser(authData.user);

        const empResponse = await fetch("/api/employees");
        if (empResponse.ok) {
          const empData = await empResponse.json();
          const records = Array.isArray(empData)
            ? empData
            : empData.employees || [];
          setEmployeeDirectory(records);
        }
      } catch (err) {
        setUser({ id: "1", email: "manager@gofresh.com", role: "manager" });
        setEmployeeDirectory([
          {
            staffCode: "GF001",
            fullName: "CHIMWEMWE PHIRI",
            email: "c.phiri@gofresh.com",
            designation: "Supervisor",
            department: "Operations",
            costCenter: "Main Barn",
            status: "Active",
            workType: "In Office",
          },
          {
            staffCode: "GF002",
            fullName: "ATUPELE BANDAL",
            email: "a.bandal@gofresh.com",
            designation: "General Manager",
            department: "Administration",
            costCenter: "Front Office",
            status: "Active",
            workType: "Hybrid",
          },
          {
            staffCode: "GF003",
            fullName: "BRIAN CHIKWA",
            email: "b.chikwa@gofresh.com",
            designation: "Maintenance Lead",
            department: "Engineering",
            costCenter: "Workshop",
            status: "Active",
            workType: "In Office",
          },
          {
            staffCode: "GF004",
            fullName: "SARAH CHEN",
            email: "sarah@company.com",
            designation: "UX Designer",
            department: "Design",
            costCenter: "HQ",
            status: "Active",
            workType: "Hybrid",
          },
          {
            staffCode: "GF005",
            fullName: "DANIEL KIM",
            email: "d.kim@company.com",
            designation: "DevOps Engineer",
            department: "Engineering",
            costCenter: "Remote Hub",
            status: "Inactive",
            workType: "Remote",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
    initializeDashboard();
  }, [router]);

  useEffect(() => {
    async function syncAttendanceData() {
      if (!user) return;
      setIsSyncingData(true);
      try {
        const response = await fetch(`/api/attendance?page=0&size=2500`);
        if (response.ok) {
          const payload = await response.json();
          setRawSwipesBuffer(payload.swipes || []);
          addLog("Successfully loaded clock records from the database.");
        } else {
          const todayString = new Date().toISOString().split("T")[0];
          setRawSwipesBuffer([
            {
              id: "GF001",
              date: todayString,
              weekDay: "Today",
              time: "07:15",
              type: "Check In",
            },
            {
              id: "GF001",
              date: todayString,
              weekDay: "Today",
              time: "16:30",
              type: "Check Out",
            },
            {
              id: "GF002",
              date: todayString,
              weekDay: "Today",
              time: "07:48",
              type: "Check In",
            },
            {
              id: "GF002",
              date: todayString,
              weekDay: "Today",
              time: "17:00",
              type: "Check Out",
            },
            {
              id: "GF003",
              date: todayString,
              weekDay: "Today",
              time: "08:10",
              type: "Check In",
            },
            {
              id: "GF004",
              date: todayString,
              weekDay: "Today",
              time: "07:25",
              type: "Check In",
            },
          ]);
          addLog("Loaded daily helper records example.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSyncingData(false);
      }
    }
    syncAttendanceData();
  }, [user]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [workersDataset, setWorkersDataset] = useState<EmployeeProfile[]>([]);

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Guard Check: Ensure all mandatory values are selected
    if (
      !newStaffCode ||
      !newStaffName ||
      !newStaffDesignation ||
      !newStaffDept ||
      !newStaffCostCenter
    ) {
      alert("Please complete all required fields before saving.");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 2. Assemble payload matching database column naming rules
      const payload = {
        staff_code: newStaffCode.trim().toUpperCase(),
        full_name: newStaffName.trim().toUpperCase(),
        designation: newStaffDesignation,
        department: newStaffDept,
        cost_center: newStaffCostCenter,
      };

      // 3. Post data to your Next.js API route handler
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save employee records.");
      }

      // 4. Extract the formatted camelCase employee returned from the API route
      const { employee } = result;

      // 5. Update the master source state (workersDataset) immediately
      setWorkersDataset((prev) => [...prev, employee]);

      // 6. Push a status update notice to your visible system logs feed at the bottom
      setSystemLogs((prev) => [
        `[SUCCESS] Registered employee ${employee.staffCode} (${employee.fullName}) directly to database.`,
        ...prev.slice(0, 19),
      ]);

      // 7. Reset all form fields and shut the modal overlay
      setNewStaffCode("");
      setNewStaffName("");
      setNewStaffDesignation("");
      setNewStaffDept("");
      setNewStaffCostCenter("");
      setIsAddModalOpen(false);

      setSystemLogs((prev) => [
        `[SUCCESS] Employee successfully registered to GoFresh Database!`,
        ...prev.slice(0, 19),
      ]);
    } catch (error: any) {
      console.error("Database Form Submission Failure:", error);
      alert(`Submission Error: ${error.message}`);

      setSystemLogs((prev) => [
        `[ERROR] Failed database write operation: ${error.message}`,
        ...prev.slice(0, 19),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

 const handleBulkEmployeeExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBulkEmployeeUploading(true);
    addLog(`Reading your uploaded roster excel file: ${file.name}`);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        
        // 1. Matches your exact ArrayBuffer timecard ingestion logic
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as any[];

        // 2. Scan the rows to find the index where the Employee headers begin
        const headerIdx = rawRows.findIndex(
          (row) =>
            Array.isArray(row) &&
            row.some((c) => String(c).trim() === "Staff Code") &&
            row.some((c) => String(c).trim() === "Full Name"),
        );

        if (headerIdx !== -1) {
          const headers = rawRows[headerIdx].map((h: any) => String(h).trim());

          // 3. Track the precise index offsets for your GoFresh employee list template
          const staffCodeIdx = headers.indexOf("Staff Code");
          const fullNameIdx = headers.indexOf("Full Name");
          const designationIdx = headers.indexOf("Designation");
          const departmentIdx = headers.indexOf("Department Name");
          const costCenterIdx = headers.indexOf("Cost Centre");

          const cleanEmployees: any[] = [];
          
          // Slice down past the titles/metadata to start mapping rows
          rawRows.slice(headerIdx + 1).forEach((row) => {
            if (!row || !row[staffCodeIdx] || !row[fullNameIdx]) return;

            // Map keys cleanly to align with the parameter signatures your backend route needs
            cleanEmployees.push({
              staffCode: String(row[staffCodeIdx]).trim().toUpperCase(),
              fullName: String(row[fullNameIdx]).trim().toUpperCase(),
              designation: designationIdx !== -1 && row[designationIdx] ? String(row[designationIdx]).trim() : "Operator",
              department: departmentIdx !== -1 && row[departmentIdx] ? String(row[departmentIdx]).trim() : "Operations",
              costCenter: costCenterIdx !== -1 && row[costCenterIdx] ? String(row[costCenterIdx]).trim() : "Main Barn",
            });
          });

          if (cleanEmployees.length === 0) {
            throw new Error("No valid personnel metadata lines could be matched.");
          }

          addLog(`Uploading ${cleanEmployees.length} clean employee registry records to database transaction...`);

          // 4. Fire payload array to your dedicated database API route
          const response = await fetch("/api/employees/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ employees: cleanEmployees }),
          });

          const result = await response.json();

          if (response.ok) {
            addLog(`Successfully synchronized ${cleanEmployees.length} employee profiles to backend records.`);
          
          } else {
            alert(`Roster Sync Failed: ${result.error || "Server transaction rejected."}`);
            addLog(`[ROSTER API ERROR]: ${result.error || "Batch payload rejected."}`);
          }
        } else {
          alert("Invalid roster format. Could not locate required columns: 'Staff Code' and 'Full Name'.");
          addLog("Spreadsheet validation failed: Target anchors missing.");
        }
      } catch (err: any) {
        console.error("Bulk Roster Upload Error Context:", err);
        alert(`Process Error: ${err.message || "Failed reading sheet rows safely."}`);
      } finally {
        setIsBulkEmployeeUploading(false);
        // Clear value pointer so the same file name can be uploaded repeatedly
        if (excelBulkInputRef.current) excelBulkInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleStaffStatus = (code: string) => {
    setEmployeeDirectory((prev) =>
      prev.map((emp) =>
        emp.staffCode === code
          ? { ...emp, status: emp.status === "Active" ? "Inactive" : "Active" }
          : emp,
      ),
    );
    addLog(`Toggled active status threshold for employee target: ${code}`);
  };

  const systemProcessedDataset = useMemo(() => {
    // Look at dates available in the swipes buffer
    const foundDates = Array.from(new Set(rawSwipesBuffer.map((s) => s.date)));

    // 🚀 FIX HERE: If a selectedDate is active, isolate that date.
    // Otherwise fallback safely to found data bounds or today's date context string.
    const uniqueDates = selectedDate
      ? [selectedDate]
      : foundDates.length > 0
        ? foundDates.sort()
        : [new Date().toISOString().split("T")[0]];

    return employeeDirectory.map((emp) => {
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let presentDaysCount = 0;
      const dailyAttendanceRecords: DailyAttendanceGroup[] = [];

      uniqueDates.forEach((dateStr) => {
        if (monthFilter !== "ALL" && !dateStr.startsWith(monthFilter)) return;
        const weekNum = "Wk " + dateStr;

        const daySwipes = rawSwipesBuffer.filter(
          (s) => s.id === emp.staffCode && s.date === dateStr,
        );
        if (daySwipes.length === 0) {
          dailyAttendanceRecords.push({
            date: dateStr,
            weekDay: "Workday",
            weekOfYear: weekNum,
            clockIn: "—",
            clockOut: "—",
            hoursWorked: 0,
            overtimeHours: 0,
            totalShiftHours: 0,
            status: "NO RECORD FOUND",
          });
          return;
        }

        const weekDay = daySwipes[0].weekDay || "Workday";
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
        let dayStatus: "ON TIME" | "LATE" | "MISSED A CLOCK PUNCH" = "ON TIME";

        const dateObj = new Date(dateStr);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        const currentDayCap = isWeekend ? 5.5 : 8.5;

        // CRITICAL CHANGE: Only process calculations if BOTH clockIn and clockOut exist
        if (clockIn === "—" || clockOut === "—") {
          dayStatus = "MISSED A CLOCK PUNCH";
          regularHours = 0;
          overtimeHours = 0;
          totalShiftHours = 0;

          // Optional: If you still consider them late if their partial checkIn is late
          if (clockIn !== "—" && clockIn > "07:30") {
            dayStatus = "LATE"; // Or keep it as "MISSED A CLOCK PUNCH" based on your preference
          }
        } else {
          const [inH, inM] = clockIn.split(":").map(Number);
          const [outH, outM] = clockOut.split(":").map(Number);
          const minutesDiff = outH * 60 + outM - (inH * 60 + inM);

          totalShiftHours = parseFloat((minutesDiff / 60).toFixed(2));
          if (totalShiftHours < 0) totalShiftHours = 0;

          if (clockIn > "07:30") {
            dayStatus = "LATE";
          } else {
            dayStatus = "ON TIME";
          }
          presentDaysCount++;

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
        records: dailyAttendanceRecords,
        metrics: {
          totalRegularHours: parseFloat(totalRegularHours.toFixed(2)),
          totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
          totalHoursSum: parseFloat(totalHoursSum.toFixed(2)),
          presentDaysCount,
        },
      };
    });
  }, [employeeDirectory, rawSwipesBuffer, monthFilter]);

  // Derive dynamic list of Cost Centers based on selected department to avoid dead-ends
  const availableCostCenters = useMemo(() => {
    if (!checklistDept) return [];
    const uniqueCCs = new Set(
      systemProcessedDataset
        .filter((emp) => emp.department === checklistDept)
        .map((emp) => emp.costCenter),
    );
    return Array.from(uniqueCCs);
  }, [checklistDept, systemProcessedDataset]);

  const handleMarkManualAttendance = async (
    staffCode: string,
    fullName: string,
  ) => {
    setIsSubmittingManualAttendance(staffCode);

    // Structure a standard manual "In" punch format
    const manualRecord = {
      id: staffCode,
      date: selectedDate, // Logs to the active date filter
      weekDay: new Date(selectedDate).toLocaleDateString("en-US", {
        weekday: "long",
      }),
      time: new Date()
        .toLocaleTimeString("en-US", { hour12: false })
        .slice(0, 5), // "HH:MM" format
      type: "Manual In",
      isManualOverride: true,
      reason: "Remote Shop / Offsite Manual Checklist Synchronization",
    };

    try {
      const response = await fetch("/api/attendance/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [manualRecord],
          operatorEmail: user?.email || "CHECKLIST_MANAGER_AGENT",
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        addLog(
          `[MANUAL OVERRIDE] Marked ${fullName} (${staffCode}) as Present at Remote Shop.`,
        );

        // Update the local attendance cache when the setter is available.
        if (typeof setRawSwipesBuffer === "function") {
          setRawSwipesBuffer((prev) => [...prev, manualRecord]);
        } else {
          window.location.reload();
        }
      } else {
        alert(result.error || "Failed to log override.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingManualAttendance(null);
    }
  };

  // 1️⃣ MOVE THIS FIRST (targetTimelineDates)

  // 2️⃣ PLACE THIS SECOND (liveMetricsRollup)
  const liveMetricsRollup = useMemo(() => {
    // Filter raw swipes that fall strictly within our start and end dates
    const recordsInRange = rawSwipesBuffer.filter((s) => {
      if (!s.date) return false;
      return s.date >= startDate && s.date <= endDate;
    });

    let onsite = 0;
    let onTime = 0;
    let late = 0;
    let absent = 0;

    employeeDirectory.forEach((emp) => {
      const employeeSwipesInRange = recordsInRange.filter(
        (s) => s.id === emp.staffCode,
      );

      if (employeeSwipesInRange.length > 0) {
        onsite++; // The employee checked in at least once during this timeframe

        // Find their first absolute check-in time inside the range to flag arrival habits
        const ins = employeeSwipesInRange
          .filter((s) => s.type.toLowerCase().includes("in"))
          .sort((a, b) => a.time.localeCompare(b.time));

        const firstIn =
          ins.length > 0 ? ins[0].time : employeeSwipesInRange[0].time;

        if (firstIn <= "07:30") {
          onTime++;
        } else {
          late++;
        }
      } else {
        absent++; // Zero records found for this employee across the whole range window
      }
    });

    return { onsite, onTime, late, absent, total: employeeDirectory.length };
  }, [rawSwipesBuffer, employeeDirectory, startDate, endDate]);

  const filteredViewDataset = useMemo(() => {
    return systemProcessedDataset.filter((row) => {
      return (
        row.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.staffCode.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [systemProcessedDataset, searchQuery]);

  const staffModuleDataset = useMemo(() => {
    return systemProcessedDataset.filter((row) => {
      const textMatch =
        row.fullName.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
        row.staffCode.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
        row.department.toLowerCase().includes(staffSearchQuery.toLowerCase());

      if (staffSubTab === "ACTIVE") return textMatch && row.status === "Active";
      if (staffSubTab === "INACTIVE")
        return textMatch && row.status === "Inactive";
      return textMatch;
    });
  }, [systemProcessedDataset, staffSubTab, staffSearchQuery]);

  // Derive headcount summary totals for selected operational department workspace bounds

  const departmentMetrics = useMemo(() => {
    const counts: Record<string, { total: number; active: number }> = {};
    systemProcessedDataset.forEach((e) => {
      if (!counts[e.department]) counts[e.department] = { total: 0, active: 0 };
      counts[e.department].total++;
      if (e.status === "Active") counts[e.department].active++;
    });
    return Object.entries(counts).map(([name, data]) => ({ name, ...data }));
  }, [systemProcessedDataset]);

  const allHistoricalSwipes = useMemo(() => {
    return [...rawSwipesBuffer].sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
    );
  }, [rawSwipesBuffer]);

  const dynamicFilterMenus = useMemo(() => {
    const monthsSet = new Set<string>();
    rawSwipesBuffer.forEach((swipe) => {
      if (swipe.date) monthsSet.add(swipe.date.substring(0, 7));
    });
    return Array.from(monthsSet).sort();
  }, [rawSwipesBuffer]);

  const handleFileUploadDispatch = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    addLog(`Reading your uploaded excel file: ${file.name}`);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as any[];

        const isBiometricLog = rawRows.some(
          (row) =>
            Array.isArray(row) &&
            row.some((c) => String(c).trim() === "Card Swiping Type"),
        );

        if (isBiometricLog) {
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

          const dynamicSwipes: any[] = [];
          rawRows.slice(headerIdx + 1).forEach((row) => {
            if (!row || !row[idIdx] || !row[dateIdx] || !row[timeIdx]) return;
            dynamicSwipes.push({
              id: String(row[idIdx]).trim().toUpperCase(),
              date: String(row[dateIdx]).trim(),
              weekDay: String(row[weekIdx] || "").trim(),
              time: String(row[timeIdx]).trim(),
              type: String(row[typeIdx] || "").trim(),
            });
          });

          setRawSwipesBuffer(dynamicSwipes);
          addLog(
            `Sending ${dynamicSwipes.length} clean biometric entries to database cluster...`,
          );

          // 🚀 CONNECTED PIPELINE: Sync with your new Prisma Batch route
          const response = await fetch("/api/attendance/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              records: dynamicSwipes,
              operatorEmail: "DASHBOARD_EXCEL_INGEST", // Pass actual session email here if available
            }),
          });

          const result = await response.json();

          if (response.ok && result.success) {
            setBavStatus({
              type: "success",
              message: `Successfully synchronized ${dynamicSwipes.length} live records to database!`,
            });
            addLog(
              "Fresh biometric timecards added to calculation pools and persisted successfully.",
            );
          } else {
            setBavStatus({
              type: "error",
              message: `Sync Failed: ${result.error || "Database transmission rejected."}`,
            });
            addLog(
              `[DATABASE ERROR]: ${result.details || "Check server log tags"}`,
            );
          }
        } else {
          setBavStatus({
            type: "error",
            message: "Invalid format. 'Card Swiping Type' headers missing.",
          });
        }
      } catch (err) {
        setBavStatus({
          type: "error",
          message:
            "Could not read this Excel file. Make sure it contains proper timecard sheets.",
        });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const generateEmployeeProfilePDF = (emp: any) => {
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235);
      doc.text("TIMENOX EMPLOYEE DOSSIER REPORT", 14, 20);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 25, 196, 25);

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        14,
        32,
      );

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("Personal & Structural Card Information", 14, 45);

      const generalMetadata = [
        ["Staff Code ID", emp.staffCode],
        ["Full Corporate Name", emp.fullName],
        ["Assigned Email Address", emp.email],
        ["Organizational Department", emp.department],
        ["Professional Designation", emp.designation],
        ["Assigned Cost Center", emp.costCenter],
        ["Primary Work Environment", emp.workType],
        ["System Allocation Status", emp.status],
      ];

      autoTable(doc, {
        startY: 50,
        head: [["Information Profile Key", "Mapped Database Value"]],
        body: generalMetadata,
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235] },
      });

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(
        "Accumulated Cumulative Operational Metrics",
        14,
        (doc as any).lastAutoTable.finalY + 15,
      );

      const analyticsMetadata = [
        ["Total Regular Hours Logged", `${emp.metrics.totalRegularHours} hrs`],
        [
          "Total Logged Overtime Hours",
          `+${emp.metrics.totalOvertimeHours} hrs`,
        ],
        [
          "Gross Accumulated Combined Shifts",
          `${emp.metrics.totalHoursSum} hrs`,
        ],
        [
          "Validated Active Attendance Days",
          `${emp.metrics.presentDaysCount} days`,
        ],
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Operational Performance Metric", "Value Matrix"]],
        body: analyticsMetadata,
        theme: "grid",
        headStyles: { fillColor: [71, 85, 105] },
      });

      doc.save(
        `Profile_Report_${emp.staffCode}_${emp.fullName.replace(/\s+/g, "_")}.pdf`,
      );
      addLog(
        `Safely downloaded local client data PDF ledger card for ${emp.fullName}`,
      );
    } catch (e) {
      console.error("PDF engine failure", e);
    }
  };

  const downloadOverallAnalyticsPDF = () => {
    if (!checklistDept || !checklistCostCenter) {
      alert("Please select a Department and Cost Center first.");
      return;
    }

    // Helper engine to convert "HH:MM" timestamp strings into total minutes
    const parseTimeToMinutes = (timeStr: string): number => {
      if (!timeStr || timeStr === "—") return 0;
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };

    try {
      const doc = new jsPDF();

      // 1. Determine Day of the Week & Shift Benchmarks
      // Expects selectedDate to be in a standard format (e.g., "YYYY-MM-DD" or "MM/DD/YYYY")
      const dateObj = new Date(selectedDate);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday, 1-5 = Mon-Fri
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Define standard working configurations in minutes (minus 1 hour lunch break)
      const lunchDeductionMins = 60;
      let standardShiftMins = 0;
      let dayTypeText = "";

      if (isWeekend) {
        // 07:30 to 13:00 is 5.5 hours (330 mins). Minus 60 mins lunch = 270 mins (4.5 hours)
        standardShiftMins = 5.5 * 60 - lunchDeductionMins;
        dayTypeText = "Weekend Rules Apply (4.5h Regular Benchmark)";
      } else {
        // 07:30 to 17:00 is 9.5 hours (570 mins). Minus 60 mins lunch = 510 mins (8.5 hours)
        standardShiftMins = 9.5 * 60 - lunchDeductionMins;
        dayTypeText = "Weekday Rules Apply (8.5h Regular Benchmark)";
      }

      // 2. Render Corporate Branding Header
      try {
        doc.addImage("/gofresh_logo.jpg", "JPEG", 14, 12, 25, 25);
      } catch (logoErr) {
        console.warn(
          "Logo image could not be loaded, skipping render.",
          logoErr,
        );
      }

      // 3. Document Title & Operational Metadata Layout
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(37, 99, 235); // Blue-600
      doc.text("OVERALL OPERATIONAL ANALTICS REPORT", 44, 20);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Department: ${checklistDept}  |  Cost Center: ${checklistCostCenter}`,
        44,
        27,
      );
      doc.text(
        `Target Date: ${selectedDate} (${dayTypeText})  |  Generated: ${new Date().toLocaleTimeString()}`,
        44,
        33,
      );

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 42, 196, 42);

      // 4. Filter Target Personnel Dataset Matrix
      const subsetWorkers = systemProcessedDataset.filter(
        (emp) =>
          emp.department === checklistDept &&
          emp.costCenter === checklistCostCenter,
      );

      // Trackers for Summary KPI Blocks
      let onsiteCount = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      // 5. Compute Swipe Metrics, Hours, & Compile Rows
      const tableRows = subsetWorkers.map((emp) => {
        const daySwipes = rawSwipesBuffer.filter(
          (s) => s.id === emp.staffCode && s.date === selectedDate,
        );

        const checkIns = daySwipes
          .filter((s) => s.type.toLowerCase().includes("in"))
          .sort((a, b) => a.time.localeCompare(b.time));

        const checkOuts = daySwipes
          .filter((s) => s.type.toLowerCase().includes("out"))
          .sort((a, b) => a.time.localeCompare(b.time));

        const clockIn = checkIns.length > 0 ? checkIns[0].time : "—";
        const clockOut =
          checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].time : "—";

        let status = "ABSENT";
        let regularHoursStr = "0.00";
        let overtimeStr = "0.00";

        // Strict historical logic: requires both pieces of structural data
        if (clockIn !== "—" && clockOut !== "—") {
          onsiteCount++;

          if (clockIn <= "07:30") {
            onTimeCount++;
            status = "ON TIME";
          } else {
            lateCount++;
            status = "LATE";
          }

          // Calculate total gross time in minutes
          const startMins = parseTimeToMinutes(clockIn);
          const endMins = parseTimeToMinutes(clockOut);

          // Net Time worked after enforcing the 1-hour unpaid lunch break deduction
          const totalMinsWorked = Math.max(
            0,
            endMins - startMins - lunchDeductionMins,
          );

          if (totalMinsWorked > standardShiftMins) {
            regularHoursStr = (standardShiftMins / 60).toFixed(2); // caps at max standard shift limit (8.5 or 4.5)
            const otMins = totalMinsWorked - standardShiftMins;
            overtimeStr = (otMins / 60).toFixed(2);
          } else {
            regularHoursStr = (totalMinsWorked / 60).toFixed(2);
            overtimeStr = "0.00";
          }
        } else {
          absentCount++;
        }

        return [
          emp.staffCode,
          emp.fullName,
          clockIn,
          clockOut,
          status,
          regularHoursStr,
          overtimeStr,
        ];
      });

      // 6. Draw Aggregate Summary Matrix Banner Block
      doc.setFont("helvetica", "bold");
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, 46, 182, 12, "F");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Summary Matrix -> Total Headcount: ${subsetWorkers.length}  |  Fully Onsite: ${onsiteCount}  |  On Time: ${onTimeCount}  |  Late: ${lateCount}  |  Absent/Incomplete: ${absentCount}`,
        18,
        54,
      );

      // 7. Generate Master Data Table via autoTable Engine
      autoTable(doc, {
        startY: 64,
        head: [
          [
            "Staff ID",
            "Employee Full Name",
            "Clock In",
            "Clock Out",
            "Status",
            "Reg Hours",
            "OT Hours",
          ],
        ],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          5: { halign: "right" },
          6: { halign: "right" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 4) {
            if (data.cell.raw === "ON TIME")
              data.cell.styles.textColor = [16, 185, 129];
            if (data.cell.raw === "LATE")
              data.cell.styles.textColor = [245, 158, 11];
            if (data.cell.raw === "ABSENT")
              data.cell.styles.textColor = [244, 63, 94];
          }
          if (
            data.section === "body" &&
            data.column.index === 6 &&
            data.cell.raw !== "0.00"
          ) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [79, 70, 229];
          }
        },
      });

      // 8. Trigger File Save Dialog & Write System Log
      doc.save(
        `Overall_Analytics_${checklistDept.replace(/\s+/g, "_")}_${selectedDate}.pdf`,
      );

      if (typeof addLog === "function") {
        addLog(
          `Master analytics report successfully compiled for ${checklistDept} on date ${selectedDate}.`,
        );
      }
    } catch (err) {
      console.error("Master PDF generation block failure", err);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-sm">
              GF
            </div>
            <div>
              <span className="font-extrabold text-xs tracking-wider uppercase block text-slate-800">
                GoFresh Home
              </span>
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">
                System Active
              </span>
            </div>
          </div>

          <nav className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold uppercase">
            <button
              onClick={() => setActiveTab("OVERVIEW")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "OVERVIEW" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab("CHECKLIST")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "CHECKLIST" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <UserCheck className="w-4 h-4" /> Daily Checklist
            </button>
            <button
              onClick={() => setActiveTab("STAFF_PANEL")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "STAFF_PANEL" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Users className="w-4 h-4" /> Staff Management
            </button>
            <button
              onClick={() => setActiveTab("REPORTS_HUB")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "REPORTS_HUB" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <CalendarDays className="w-4 h-4" /> Detailed Logs
            </button>
            <button
              onClick={() => setActiveTab("SUMMARY")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "SUMMARY" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <CalendarDays className="w-4 h-4" /> Summary
            </button>
            <button
              onClick={() => setActiveTab("SETTINGS")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "SETTINGS" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUploadDispatch}
              accept=".xlsx, .xls, .csv"
              className="hidden"
              id="header-file-uploader"
            />
            <Button
              asChild
              variant="outline"
              className="h-9 border-blue-200 text-blue-600 text-xs font-bold cursor-pointer"
            >
              <label htmlFor="header-file-uploader">
                <UploadCloud className="w-4 h-4 mr-1 shrink-0" />
                <span>{isUploading ? "Reading..." : "Upload Timecard"}</span>
              </label>
            </Button>
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={excelBulkInputRef}
                onChange={handleBulkEmployeeExcelUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
               id="excel-bulk-file-uploader"
              />
              <Button
                asChild
                variant="outline"
                className="h-9 border-blue-200 text-blue-600 text-xs font-bold cursor-pointer"
              >
                <label htmlFor="excel-bulk-file-uploader">
                  <UploadCloud className="w-4 h-4 mr-1 shrink-0" />
                  <span>
                    {isBulkEmployeeUploading
                      ? "Processing Batch..."
                      : "Upload Employees"}
                  </span>
                </label>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {isSyncingData ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
          <div className="p-3 bg-blue-50 text-blue-700 text-xs font-bold uppercase rounded-lg">
            Updating active timelines and processing internal rosters...
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonBox className="h-24" />
            <SkeletonBox className="h-24" />
            <SkeletonBox className="h-24" />
            <SkeletonBox className="h-24" />
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
          {bavStatus && (
            <div className="p-3 text-xs font-bold uppercase tracking-wider rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
              {bavStatus.message}
            </div>
          )}

          {/* ========================================== OVERVIEW TAB CONTENT ========================================== */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                    Workforce Attendance Analytics Dashboard
                  </h2>
                  <p className="text-xs text-slate-400 font-medium uppercase">
                    Select target transaction dates below to parse automatic
                    card metric accumulations.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2">
                  {/* 🗓️ DUAL PARAMETER RANGE PROCESSING CONSOLE */}
                  <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl shadow-xs shrink-0">
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor="start-date"
                        className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-wider"
                      >
                        From:
                      </label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-8 text-xs font-bold border-none shadow-none focus-visible:ring-0 w-auto cursor-pointer p-0 pr-2 text-blue-600 bg-transparent uppercase"
                      />
                    </div>

                    <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor="end-date"
                        className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-wider"
                      >
                        To:
                      </label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-8 text-xs font-bold border-none shadow-none focus-visible:ring-0 w-auto cursor-pointer p-0 pr-2 text-blue-600 bg-transparent uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Metric Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                  onClick={() => {
                    setSelectedMetricFilter(
                      selectedMetricFilter === "ONSITE" ? "ALL" : "ONSITE",
                    );
                    setReportDept("ALL");
                    setReportCC("ALL");
                  }}
                  className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-blue-600 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                    selectedMetricFilter === "ONSITE"
                      ? "ring-2 ring-blue-500 ring-offset-2 bg-blue-50/10"
                      : ""
                  }`}
                >
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" /> Onsite
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-slate-900 mt-1 flex justify-between items-center">
                      <span>{liveMetricsRollup.onsite} Checked In</span>
                      {selectedMetricFilter === "ONSITE" && (
                        <Badge className="bg-blue-600 text-[9px] tracking-wider">
                          FILTER ACTIVE
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card
                  onClick={() => {
                    setSelectedMetricFilter(
                      selectedMetricFilter === "ABSENT" ? "ALL" : "ABSENT",
                    );
                    setReportDept("ALL");
                    setReportCC("ALL");
                  }}
                  className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-amber-500 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                    selectedMetricFilter === "ABSENT"
                      ? "ring-2 ring-amber-500 ring-offset-2 bg-amber-50/10"
                      : ""
                  }`}
                >
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />{" "}
                      Absent
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-slate-900 mt-1 flex justify-between items-center">
                      <span>{liveMetricsRollup.absent} Workers</span>
                      {selectedMetricFilter === "ABSENT" && (
                        <Badge className="bg-amber-500 text-[9px] tracking-wider">
                          FILTER ACTIVE
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card
                  onClick={() => {
                    setSelectedMetricFilter(
                      selectedMetricFilter === "ON_TIME" ? "ALL" : "ON_TIME",
                    );
                    setReportDept("ALL");
                    setReportCC("ALL");
                  }}
                  className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-emerald-500 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                    selectedMetricFilter === "ON_TIME"
                      ? "ring-2 ring-emerald-500 ring-offset-2 bg-emerald-50/10"
                      : ""
                  }`}
                >
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> On
                      Time (&le; 07:30 AM)
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-emerald-600 mt-1 flex justify-between items-center">
                      <span>{liveMetricsRollup.onTime} Workers</span>
                      {selectedMetricFilter === "ON_TIME" && (
                        <Badge className="bg-emerald-600 text-[9px] tracking-wider">
                          FILTER ACTIVE
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card
                  onClick={() => {
                    setSelectedMetricFilter(
                      selectedMetricFilter === "LATE" ? "ALL" : "LATE",
                    );
                    setReportDept("ALL");
                    setReportCC("ALL");
                  }}
                  className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-rose-500 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                    selectedMetricFilter === "LATE"
                      ? "ring-2 ring-rose-500 ring-offset-2 bg-rose-50/10"
                      : ""
                  }`}
                >
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-rose-500" /> Late Arrivals
                      (&gt; 07:30 AM)
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-rose-600 mt-1 flex justify-between items-center">
                      <span>{liveMetricsRollup.late} Workers</span>
                      {selectedMetricFilter === "LATE" && (
                        <Badge className="bg-rose-600 text-[9px] tracking-wider">
                          FILTER ACTIVE
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* 2. Dynamic Filter View & Functional PDF Report Engine Section */}
              {(() => {
                const filteredWorkerDataset = employeeDirectory.filter(
                  (emp) => {
                    // 🚀 FIX: Evaluate swipes across the entire selected date range, matching liveMetricsRollup
                    const personalSwipes = rawSwipesBuffer.filter(
                      (s) =>
                        s.id === emp.staffCode &&
                        s.date >= startDate &&
                        s.date <= endDate,
                    );
                    const checkIns = personalSwipes
                      .filter((s) => s.type.toLowerCase().includes("in"))
                      .sort((a, b) => a.time.localeCompare(b.time));
                    const clockIn =
                      checkIns.length > 0
                        ? checkIns[0].time
                        : personalSwipes.length > 0
                          ? personalSwipes[0].time
                          : null;

                    if (
                      selectedMetricFilter === "ONSITE" &&
                      personalSwipes.length === 0
                    )
                      return false;
                    if (
                      selectedMetricFilter === "ABSENT" &&
                      personalSwipes.length > 0
                    )
                      return false;
                    if (
                      selectedMetricFilter === "ON_TIME" &&
                      (!clockIn || clockIn > "07:30")
                    )
                      return false;
                    if (
                      selectedMetricFilter === "LATE" &&
                      (!clockIn || clockIn <= "07:30")
                    )
                      return false;

                    if (reportDept !== "ALL" && emp.department !== reportDept)
                      return false;
                    if (reportCC !== "ALL" && emp.costCenter !== reportCC)
                      return false;

                    return true;
                  },
                );

                // Pure JS PDF Generation Logic

                return (
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                          Live Report Matrix
                          <Badge
                            variant="outline"
                            className="bg-slate-200 text-slate-800 border-slate-300 font-mono text-[10px] px-2 font-bold"
                          >
                            {selectedMetricFilter.replace("_", " ")}
                          </Badge>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Showing{" "}
                          <span className="font-bold text-slate-900">
                            {filteredWorkerDataset.length}
                          </span>{" "}
                          records on this display grid interface.
                        </p>
                      </div>

                      {/* ==================== FILTERS & EXPORT CONTROL BAR ==================== */}
                      <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {/* Department Dropdown Filter */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                            Department Filter:
                          </label>
                          <select
                            value={reportDept}
                            onChange={(e) => {
                              setReportDept(e.target.value);
                              setReportCC("ALL"); // Reset child dropdown to avoid orphans
                            }}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs focus:outline-none min-w-[170px]"
                          >
                            <option value="ALL">ALL DEPARTMENTS</option>
                            {Array.from(
                              new Set(
                                employeeDirectory.map((e) => e.department),
                              ),
                            )
                              .filter(Boolean)
                              .map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept.toUpperCase()}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Cost Center Dropdown Filter (Dependent) */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                            Cost Center Context:
                          </label>
                          <select
                            value={reportCC}
                            onChange={(e) => setReportCC(e.target.value)}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs focus:outline-none min-w-[170px]"
                          >
                            <option value="ALL">ALL COST CENTERS</option>
                            {Array.from(
                              new Set(
                                employeeDirectory
                                  .filter(
                                    (e) =>
                                      reportDept === "ALL" ||
                                      e.department === reportDept,
                                  )
                                  .map((e) => e.costCenter),
                              ),
                            )
                              .filter(Boolean)
                              .map((cc) => (
                                <option key={cc} value={cc}>
                                  {cc.toUpperCase()}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Dynamic Branded PDF Export Action Button */}
                        {/* Dynamic Branded PDF Export Action Button */}
                        <div className="ml-auto">
                          <Button
                            onClick={() => {
                              // 1. Create a virtual Image element to load the local public file
                              const img = new Image();
                              img.src = "/gofresh_logo.jpg"; // Path points to public/gofresh_logo.jpg

                              img.onload = () => {
                                // Convert image to canvas to get a clean JPEG data URL string
                                const canvas = document.createElement("canvas");
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext("2d");

                                if (ctx) {
                                  ctx.drawImage(img, 0, 0);
                                  const logoDataUrl =
                                    canvas.toDataURL("image/jpeg");

                                  // Initialize jsPDF inside the load callback
                                  const doc = new jsPDF({
                                    orientation: "portrait",
                                    unit: "mm",
                                    format: "a4",
                                  });

                                  // HEADER BANNER GRAPHIC (Deep Slate Blue)
                                  doc.setFillColor(30, 41, 59); // Slate 800
                                  doc.rect(0, 0, 210, 42, "F");

                                  // ======================================================================
                                  // 2. LOGO RENDER
                                  // ======================================================================
                                  // Parameters: image, format, x, y, width, height
                                  doc.addImage(
                                    logoDataUrl,
                                    "JPEG",
                                    14,
                                    11,
                                    14,
                                    14,
                                  );
                                  // ======================================================================

                                  // 3. DYNAMIC CONTENT DOCK HEADERS
                                  doc.setTextColor(255, 255, 255);
                                  doc.setFont("helvetica", "bold");
                                  doc.setFontSize(13);

                                  const activeDeptText =
                                    reportDept === "ALL"
                                      ? "ALL DEPARTMENTS"
                                      : reportDept.toUpperCase();
                                  const activeCcText =
                                    reportCC === "ALL"
                                      ? "ALL COST CENTERS"
                                      : reportCC.toUpperCase();

                                  doc.text(
                                    `ATTENDANCE REPORT: ${activeDeptText}`,
                                    52,
                                    16,
                                  );

                                  // Subtext Meta Parameters
                                  doc.setFont("helvetica", "normal");
                                  doc.setFontSize(8.5);
                                  doc.setTextColor(203, 213, 225); // Slate 300
                                  doc.text(
                                    `Cost Center Context: ${activeCcText}`,
                                    52,
                                    22,
                                  );
                                  doc.text(
                                    `Date Range Window: ${startDate} to ${endDate}   |   Export Run Time: ${new Date().toLocaleTimeString()}`,
                                    52,
                                    27,
                                  );

                                  // 4. METRIC STATUS CONTEXT CALLOUT BADGE
                                  doc.setFillColor(248, 250, 252);
                                  doc.setDrawColor(226, 232, 240);
                                  doc.rect(14, 48, 182, 16, "FD");

                                  doc.setFontSize(9);
                                  doc.setTextColor(71, 85, 105);
                                  doc.setFont("helvetica", "bold");
                                  doc.text(
                                    "CURRENT PARAMETER SELECTION CRITERIA:",
                                    18,
                                    54,
                                  );

                                  // Active Metric Highlight Pill
                                  doc.setFillColor(239, 246, 255);
                                  doc.rect(102, 50.5, 34, 5, "F");
                                  doc.setTextColor(29, 78, 216);
                                  doc.setFontSize(8);
                                  doc.text(
                                    `METRIC: ${selectedMetricFilter}`,
                                    104,
                                    54.2,
                                  );

                                  doc.setFont("helvetica", "normal");
                                  doc.setTextColor(100, 116, 139);
                                  doc.text(
                                    `Total Records Found Matching Active Filters: ${filteredWorkerDataset.length} Employee(s)`,
                                    18,
                                    60,
                                  );

                                  // 5. DATASET TABLE ROW MAPPER
                                  const tableRows = filteredWorkerDataset.map(
                                    (emp) => {
                                      const trackingSwipes = rawSwipesBuffer
                                        .filter(
                                          (s) =>
                                            s.id === emp.staffCode &&
                                            s.date >= startDate &&
                                            s.date <= endDate,
                                        )
                                        .sort(
                                          (a, b) =>
                                            a.date.localeCompare(b.date) ||
                                            a.time.localeCompare(b.time),
                                        );

                                      const inPunches = trackingSwipes.filter(
                                        (s) =>
                                          s.type.toLowerCase().includes("in"),
                                      );
                                      const clockInTime =
                                        inPunches.length > 0
                                          ? inPunches[0].time
                                          : trackingSwipes.length > 0
                                            ? trackingSwipes[0].time
                                            : null;

                                      const clockInDate =
                                        inPunches.length > 0
                                          ? inPunches[0].date
                                          : trackingSwipes.length > 0
                                            ? trackingSwipes[0].date
                                            : "";

                                      const rawSwipesString =
                                        trackingSwipes.length > 0
                                          ? trackingSwipes
                                              .map(
                                                (s) =>
                                                  `${s.type.toUpperCase()}(${s.time} - ${s.date?.substring(5)})`,
                                              )
                                              .join(", ")
                                          : "No records found";

                                      let calculatedStatus = "ABSENT";
                                      if (clockInTime) {
                                        calculatedStatus =
                                          clockInTime <= "07:30"
                                            ? "ON TIME"
                                            : "LATE ARRIVAL";
                                      }

                                      return [
                                        `${emp.fullName.toUpperCase()}\n[ID: ${emp.staffCode}]`,
                                        `${emp.department.toUpperCase()}\n[CC: ${emp.costCenter.toUpperCase()}]`,
                                        clockInTime
                                          ? `${clockInTime} AM (${clockInDate.substring(5)})`
                                          : "--:--",
                                        rawSwipesString,
                                        calculatedStatus,
                                      ];
                                    },
                                  );

                                  // 6. INJECT AUTO-TABLE LAYOUT
                                  autoTable(doc, {
                                    startY: 70,
                                    head: [
                                      [
                                        "Staff Member Details",
                                        "Department / Cost Center Allocation",
                                        "First Punch-In Time",
                                        "Raw History Timeline Actions Log",
                                        "Status Flag",
                                      ],
                                    ],
                                    body: tableRows,
                                    theme: "striped",
                                    headStyles: {
                                      fillColor: [51, 65, 85],
                                      textColor: [255, 255, 255],
                                      fontStyle: "bold",
                                      fontSize: 9,
                                    },
                                    bodyStyles: {
                                      fontSize: 8,
                                      cellPadding: 3,
                                      textColor: [51, 65, 85],
                                    },
                                    columnStyles: {
                                      0: { cellWidth: 42 },
                                      1: { cellWidth: 42 },
                                      2: { cellWidth: 26, halign: "center" },
                                      3: { cellWidth: 46 },
                                      4: { cellWidth: 26, fontStyle: "bold" },
                                    },
                                    didParseCell: (data: any) => {
                                      if (
                                        data.section === "body" &&
                                        data.column.index === 4
                                      ) {
                                        const statusText = data.cell.raw;
                                        if (statusText === "ON TIME")
                                          data.cell.styles.textColor = [
                                            22, 163, 74,
                                          ];
                                        if (statusText === "LATE ARRIVAL")
                                          data.cell.styles.textColor = [
                                            217, 119, 6,
                                          ];
                                        if (statusText === "ABSENT")
                                          data.cell.styles.textColor = [
                                            220, 38, 38,
                                          ];
                                      }
                                    },
                                  });

                                  // 7. FILE SAVE INITIATOR
                                  const fileDeptName = reportDept
                                    .replace(/\s+/g, "_")
                                    .toUpperCase();
                                  const fileCcName = reportCC
                                    .replace(/\s+/g, "_")
                                    .toUpperCase();
                                  doc.save(
                                    `ATTENDANCE_REPORT_${fileDeptName}_${fileCcName}_[${selectedMetricFilter}].pdf`,
                                  );
                                }
                              };

                              // Fallback handling if image fails to load or path doesn't exist
                              img.onerror = () => {
                                alert(
                                  "Could not find gofresh_logo.jpg in the public folder. Exporting without logo.",
                                );
                              };
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 gap-2 flex items-center rounded-lg shadow-xs transition-all"
                          >
                            <Download className="w-4 h-4" />
                            Export Filtered PDF Report
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 3. Live Data Table Grid View */}
                    <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 tracking-wider uppercase">
                              <th className="p-3">Staff Member</th>
                              <th className="p-3">Department / Cost Center</th>
                              <th className="p-3">First Clock In</th>
                              <th className="p-3">Punches / Activities</th>
                              <th className="p-3 text-right">Status Flag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {filteredWorkerDataset.length > 0 ? (
                              filteredWorkerDataset.map((emp) => {
                                // FIX: Filter swipes across the entire selected date range instead of a single day
                                const trackingSwipes = rawSwipesBuffer
                                  .filter(
                                    (s) =>
                                      s.id === emp.staffCode &&
                                      s.date >= startDate &&
                                      s.date <= endDate,
                                  )
                                  .sort(
                                    (a, b) =>
                                      a.date.localeCompare(b.date) ||
                                      a.time.localeCompare(b.time),
                                  );

                                const inPunches = trackingSwipes.filter((s) =>
                                  s.type.toLowerCase().includes("in"),
                                );

                                // Grabs their very first clock-in time during this entire range timeframe
                                const clockInTime =
                                  inPunches.length > 0
                                    ? inPunches[0].time
                                    : trackingSwipes.length > 0
                                      ? trackingSwipes[0].time
                                      : null;

                                // Grabs the corresponding date for that first clock-in
                                const clockInDate =
                                  inPunches.length > 0
                                    ? inPunches[0].date
                                    : trackingSwipes.length > 0
                                      ? trackingSwipes[0].date
                                      : null;

                                return (
                                  <tr
                                    key={emp.staffCode}
                                    className="hover:bg-slate-50/70 transition-colors"
                                  >
                                    <td className="p-3">
                                      <div className="font-bold text-slate-900 uppercase">
                                        {emp.fullName}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400">
                                        {emp.staffCode}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-slate-700 uppercase text-[11px]">
                                        {emp.department}
                                      </div>
                                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                        {emp.costCenter}
                                      </div>
                                    </td>
                                    <td className="p-3 font-mono font-bold text-slate-800">
                                      {clockInTime
                                        ? `${clockInTime} AM (${clockInDate?.substring(5)})` // Appends MM-DD for range clarity
                                        : "--:--"}
                                    </td>
                                    <td className="p-3">
                                      {trackingSwipes.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 max-w-sm">
                                          {trackingSwipes.map((s, idx) => (
                                            <Badge
                                              key={idx}
                                              variant="outline"
                                              className={`text-[9px] font-mono font-bold px-1.5 py-0 rounded ${
                                                s.type
                                                  .toLowerCase()
                                                  .includes("in")
                                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                  : "bg-rose-50 text-rose-700 border-rose-200"
                                              }`}
                                            >
                                              {s.type.toUpperCase()} ({s.time} -{" "}
                                              {s.date?.substring(5)})
                                            </Badge>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] italic text-slate-400 font-normal">
                                          No activity logs recorded
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right">
                                      {!clockInTime ? (
                                        <Badge
                                          variant="destructive"
                                          className="text-[9px] font-black tracking-widest bg-rose-600"
                                        >
                                          ABSENT
                                        </Badge>
                                      ) : clockInTime <= "07:30" ? (
                                        <Badge className="text-[9px] font-black tracking-widest bg-emerald-600 text-white">
                                          ON TIME
                                        </Badge>
                                      ) : (
                                        <Badge className="text-[9px] font-black tracking-widest bg-amber-500 text-white">
                                          LATE
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="text-center p-8 text-slate-400 font-semibold italic uppercase"
                                >
                                  No employees match the requested parameters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === "CHECKLIST" && (
            <div className="space-y-6">
              {/* Cascade Filter Control Board */}
              <Card className="bg-white border border-slate-200 shadow-xs rounded-xl">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-600" /> Operational
                        Roster Checklist Controller
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase font-semibold text-slate-400 mt-0.5">
                        Isolate departments and cost-centers to punch remote
                        shop workers into active tracking.
                      </CardDescription>
                    </div>

                    {/* Container holding both the Report Button and the Date Input side-by-side */}
                    <div className="flex items-end gap-3 shrink-0">
                      {/* 📊 OVERALL ANALYTICS REPORT BUTTON */}
                      <Button
                        variant="outline"
                        disabled={!checklistDept || !checklistCostCenter}
                        onClick={downloadOverallAnalyticsPDF}
                        className="h-9 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 hover:border-blue-300 text-blue-700 text-xs font-black uppercase tracking-wide rounded-lg flex items-center gap-2 px-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                        <span>Analytics Report</span>
                      </Button>

                      {/* 📅 DYNAMIC DATE SELECTOR ENGINE */}
                      <div className="flex flex-col text-left sm:text-right">
                        <label
                          htmlFor="target-shift-date"
                          className="text-[9px] font-black uppercase text-slate-400 block mb-1"
                        >
                          Target Shift Date
                        </label>
                        <input
                          id="target-shift-date"
                          type="date"
                          value={selectedDate}
                          min="2026-01-01"
                          max="2026-12-31"
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="h-9 bg-white border border-slate-200 text-xs font-mono font-black text-blue-600 uppercase rounded-lg p-1 px-2 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer tracking-wider"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                  {/* Step A: Choose Department */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                      1. Select Target Department
                    </label>
                    <select
                      value={checklistDept}
                      onChange={(e) => {
                        setChecklistDept(e.target.value);
                        setChecklistCostCenter(""); // Reset downstream filter
                      }}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2 uppercase text-slate-800 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Choose Workspace --</option>
                      {departmentMetrics.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step B: Choose Cost Center */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                      2. Select Cost Center Workspace
                    </label>
                    <select
                      value={checklistCostCenter}
                      disabled={!checklistDept}
                      onChange={(e) => setChecklistCostCenter(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2 uppercase text-slate-800 disabled:opacity-50 disabled:bg-slate-50 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Select Cost Center --</option>
                      {availableCostCenters.map((cc) => (
                        <option key={cc} value={cc}>
                          {cc}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Diagnostics Readout / Clear Trigger */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setChecklistDept("");
                        setChecklistCostCenter("");
                      }}
                      className="h-9 text-xs font-bold uppercase rounded-lg border-slate-200 w-full"
                    >
                      Reset Workspace Selection
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 📊 CLICKABLE SUB-METRICS REPORT CARDS BLOCK */}
              {checklistDept &&
                checklistCostCenter &&
                (() => {
                  const subsetWorkers = systemProcessedDataset.filter(
                    (emp) =>
                      emp.department === checklistDept &&
                      emp.costCenter === checklistCostCenter,
                  );

                  const groups = {
                    onsite: [] as typeof subsetWorkers,
                    onTime: [] as typeof subsetWorkers,
                    late: [] as typeof subsetWorkers,
                    absent: [] as typeof subsetWorkers,
                  };

                  subsetWorkers.forEach((emp) => {
                    const daySwipes = rawSwipesBuffer.filter(
                      (s) => s.id === emp.staffCode && s.date === selectedDate,
                    );

                    if (daySwipes.length > 0) {
                      groups.onsite.push(emp);
                      const checkIns = daySwipes
                        .filter((s) => s.type.toLowerCase().includes("in"))
                        .sort((a, b) => a.time.localeCompare(b.time));

                      const clockIn =
                        checkIns.length > 0
                          ? checkIns[0].time
                          : daySwipes[0].time;

                      if (clockIn <= "07:30") {
                        groups.onTime.push(emp);
                      } else {
                        groups.late.push(emp);
                      }
                    } else {
                      groups.absent.push(emp);
                    }
                  });

                  // Keep your existing downloadGroupPDF definition helper...

                  const downloadGroupPDF = (
                    title: string,
                    list: typeof subsetWorkers,
                  ) => {
                    try {
                      const doc = new jsPDF();

                      try {
                        doc.addImage(
                          "/gofresh_logo.jpg",
                          "JPEG",
                          14,
                          12,
                          25,
                          25,
                        );
                      } catch (logoErr) {
                        console.warn(
                          "Logo image could not be loaded, skipping render.",
                          logoErr,
                        );
                      }

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(16);
                      doc.setTextColor(37, 99, 235);
                      doc.text(
                        `CHECKLIST EXCEPTION REPORT: ${title.toUpperCase()}`,
                        44,
                        20,
                      );

                      doc.setFontSize(9);
                      doc.setFont("helvetica", "normal");
                      doc.setTextColor(71, 85, 105);
                      doc.text(
                        `Department: ${checklistDept}  |  Cost Center: ${checklistCostCenter}`,
                        44,
                        27,
                      );
                      doc.text(
                        `Target Date: ${selectedDate}  |  Generated: ${new Date().toLocaleTimeString()}`,
                        44,
                        33,
                      );

                      doc.setDrawColor(226, 232, 240);
                      doc.line(14, 42, 196, 42);

                      const tableRows = list.map((emp) => {
                        const daySwipes = rawSwipesBuffer.filter(
                          (s) =>
                            s.id === emp.staffCode && s.date === selectedDate,
                        );
                        const checkIns = daySwipes
                          .filter((s) => s.type.toLowerCase().includes("in"))
                          .sort((a, b) => a.time.localeCompare(b.time));
                        const checkOuts = daySwipes
                          .filter((s) => s.type.toLowerCase().includes("out"))
                          .sort((a, b) => a.time.localeCompare(b.time));
                        return [
                          emp.staffCode,
                          emp.fullName,
                          emp.designation,
                          checkIns.length > 0 ? checkIns[0].time : "—",
                          checkOuts.length > 0
                            ? checkOuts[checkOuts.length - 1].time
                            : "—",
                        ];
                      });

                      autoTable(doc, {
                        startY: 48,
                        head: [
                          [
                            "Staff ID",
                            "Employee Full Name",
                            "Designation",
                            "Clock In",
                            "Clock Out",
                          ],
                        ],
                        body: tableRows,
                        theme: "striped",
                        headStyles: { fillColor: [37, 99, 235] },
                        styles: { fontSize: 9, cellPadding: 3 },
                      });

                      doc.save(
                        `Checklist_${title.replace(/\s+/g, "_")}_${selectedDate}.pdf`,
                      );
                      addLog(
                        `Successfully generated and downloaded ${title} metrics document context.`,
                      );
                    } catch (err) {
                      console.error("PDF generation block failure", err);
                    }
                  };

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card
                        onClick={() =>
                          downloadGroupPDF(
                            "Fully Clocked Onsite",
                            groups.onsite,
                          )
                        }
                        className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-blue-600 shadow-xs cursor-pointer hover:bg-slate-50 hover:scale-[1.01] active:scale-95 transition-all select-none"
                      >
                        <CardHeader className="p-4">
                          <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>Fully Onsite</span>
                            <Download className="w-3.5 h-3.5 text-blue-600" />
                          </CardDescription>
                          <CardTitle className="text-xl font-black text-slate-900 mt-1">
                            {groups.onsite.length} Workers
                          </CardTitle>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase block mt-1">
                            In & Out Punches Found (Print PDF)
                          </span>
                        </CardHeader>
                      </Card>

                      <Card
                        onClick={() =>
                          downloadGroupPDF("On Time Roster", groups.onTime)
                        }
                        className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-emerald-500 shadow-xs cursor-pointer hover:bg-slate-50 hover:scale-[1.01] active:scale-95 transition-all select-none"
                      >
                        <CardHeader className="p-4">
                          <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>On Time (&lt; 7:30)</span>
                            <Download className="w-3.5 h-3.5 text-emerald-500" />
                          </CardDescription>
                          <CardTitle className="text-xl font-black text-emerald-600 mt-1">
                            {groups.onTime.length} Workers
                          </CardTitle>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase block mt-1">
                            Arrived Before 7:30 AM (Print PDF)
                          </span>
                        </CardHeader>
                      </Card>

                      <Card
                        onClick={() =>
                          downloadGroupPDF("Late Arrivals", groups.late)
                        }
                        className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-amber-500 shadow-xs cursor-pointer hover:bg-slate-50 hover:scale-[1.01] active:scale-95 transition-all select-none"
                      >
                        <CardHeader className="p-4">
                          <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>Late Arrivals</span>
                            <Download className="w-3.5 h-3.5 text-amber-500" />
                          </CardDescription>
                          <CardTitle className="text-xl font-black text-amber-600 mt-1">
                            {groups.late.length} Workers
                          </CardTitle>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase block mt-1">
                            Arrived After 7:30 AM (Print PDF)
                          </span>
                        </CardHeader>
                      </Card>

                      <Card
                        onClick={() =>
                          downloadGroupPDF(
                            "Absenteeism and Missed Shifts",
                            groups.absent,
                          )
                        }
                        className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-rose-500 shadow-xs cursor-pointer hover:bg-slate-50 hover:scale-[1.01] active:scale-95 transition-all select-none"
                      >
                        <CardHeader className="p-4">
                          <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>Absent / Incomplete</span>
                            <Download className="w-3.5 h-3.5 text-rose-500" />
                          </CardDescription>
                          <CardTitle className="text-xl font-black text-rose-600 mt-1">
                            {groups.absent.length} Workers
                          </CardTitle>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase block mt-1">
                            Missing In/Out Punches (Print PDF)
                          </span>
                        </CardHeader>
                      </Card>
                    </div>
                  );
                })()}

              {/* Attendance Checklist Grid Output */}
              <Card className="bg-white border border-slate-200 shadow-xs rounded-xl overflow-hidden">
                <CardContent className="p-0">
                  {!checklistDept || !checklistCostCenter ? (
                    <div className="p-12 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                      ⚠️ Please specify an operational Department and secondary
                      Cost Center parameters to fetch roster checklist.
                    </div>
                  ) : (
                    (() => {
                      const matchingEmployees = systemProcessedDataset.filter(
                        (emp) =>
                          emp.department === checklistDept &&
                          emp.costCenter === checklistCostCenter,
                      );

                      if (matchingEmployees.length === 0) {
                        return (
                          <div className="p-12 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                            No personnel indices registered under this
                            combination matrix.
                          </div>
                        );
                      }

                      return (
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow className="border-b border-slate-200">
                              <TableHead className="text-[10px] font-black uppercase text-slate-500 w-32">
                                Staff Code
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase text-slate-500">
                                Employee Full Name
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase text-slate-500">
                                Designation Assignment
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase text-slate-500 text-center w-40">
                                Presence Status
                              </TableHead>
                              <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right w-44">
                                Checklist Action
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {matchingEmployees.map((worker) => {
                              const workerTodayRecord = rawSwipesBuffer.filter(
                                (s) =>
                                  s.id === worker.staffCode &&
                                  s.date === selectedDate,
                              );
                              const isPresent = workerTodayRecord.length > 0;
                              const isPending =
                                isSubmittingManualAttendance ===
                                worker.staffCode;

                              return (
                                <TableRow
                                  key={worker.staffCode}
                                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                                >
                                  <TableCell className="font-mono text-xs font-bold text-slate-600">
                                    {worker.staffCode}
                                  </TableCell>
                                  <TableCell className="text-xs font-extrabold text-slate-900 uppercase">
                                    {worker.fullName}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium text-slate-500 uppercase">
                                    {worker.designation}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      className="text-[9px] font-black tracking-wide"
                                      variant={
                                        isPresent ? "secondary" : "destructive"
                                      }
                                    >
                                      {isPresent
                                        ? "CLOCKED / ONSITE"
                                        : "NOT CLOCKED"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isPresent ? (
                                      <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 text-[10px] font-black uppercase px-2.5 py-1 rounded-md border border-emerald-200">
                                        <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                                        Present Lock
                                      </div>
                                    ) : (
                                      <label className="inline-flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 px-3 rounded-lg border border-slate-200 select-none bg-white transition-all active:scale-95">
                                        {isPending ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                        ) : (
                                          <input
                                            type="checkbox"
                                            checked={false}
                                            onChange={() =>
                                              handleMarkManualAttendance(
                                                worker.staffCode,
                                                worker.fullName,
                                              )
                                            }
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                          />
                                        )}
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
                                          {isPending
                                            ? "Syncing..."
                                            : "Mark Present"}
                                        </span>
                                      </label>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      );
                    })()
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "STAFF_PANEL" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Staff Workspace
                  </h1>
                  <p className="text-xs text-slate-400 font-semibold uppercase">
                    {employeeDirectory.length} total employees registered in
                    system ecosystem
                  </p>
                </div>
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase px-4 h-10 tracking-wider flex items-center gap-2 rounded-lg"
                >
                  <UserPlus className="w-4 h-4" /> Add Staff Member
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setStaffSubTab("REGISTER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${staffSubTab === "REGISTER" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                >
                  <Briefcase className="w-3.5 h-3.5" /> Employee Register
                </button>
                <button
                  onClick={() => setStaffSubTab("ACTIVE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${staffSubTab === "ACTIVE" ? "bg-emerald-600 text-white shadow-xs" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                >
                  <UserCheck className="w-3.5 h-3.5" /> Active Employees
                </button>
                <button
                  onClick={() => setStaffSubTab("INACTIVE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${staffSubTab === "INACTIVE" ? "bg-rose-600 text-white shadow-xs" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                >
                  <UserX className="w-3.5 h-3.5" /> Inactive Employees
                </button>
                <button
                  onClick={() => setStaffSubTab("DEPARTMENTS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${staffSubTab === "DEPARTMENTS" ? "bg-purple-600 text-white shadow-xs" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                >
                  <Building2 className="w-3.5 h-3.5" /> Department List
                </button>
                <button
                  onClick={() => setStaffSubTab("HISTORY")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${staffSubTab === "HISTORY" ? "bg-amber-600 text-white shadow-xs" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                >
                  <History className="w-3.5 h-3.5" /> Attendance History
                </button>
              </div>

              {staffSubTab !== "DEPARTMENTS" && staffSubTab !== "HISTORY" && (
                <div className="relative max-w-md bg-white rounded-lg">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="Search parameters by name, email or department..."
                    className="pl-9 text-xs font-bold uppercase"
                  />
                </div>
              )}

              {(staffSubTab === "REGISTER" ||
                staffSubTab === "ACTIVE" ||
                staffSubTab === "INACTIVE") && (
                <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 border-b border-slate-200">
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Employee Details
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          ID Code
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Department
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Environment
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Status
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffModuleDataset.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-6 text-xs text-slate-400 uppercase font-bold"
                          >
                            No tracking records found matching parameters
                          </TableCell>
                        </TableRow>
                      ) : (
                        staffModuleDataset.map((emp) => (
                          <TableRow
                            key={emp.staffCode}
                            className="border-b border-slate-100 hover:bg-slate-50/50"
                          >
                            <TableCell>
                              <div>
                                <span className="text-xs font-extrabold text-slate-900 block">
                                  {emp.fullName}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 block lowercase">
                                  {emp.email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold text-slate-600">
                              {emp.staffCode}
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="text-xs font-bold text-slate-800 block uppercase">
                                  {emp.department}
                                </span>
                                <span className="text-[10px] text-slate-400 block uppercase">
                                  {emp.designation}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="text-[9px] uppercase font-bold"
                              >
                                {emp.workType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`text-[9px] font-bold uppercase cursor-pointer ${emp.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}
                                onClick={() => toggleStaffStatus(emp.staffCode)}
                              >
                                {emp.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateEmployeeProfilePDF(emp)}
                                className="h-7 text-[10px] border-blue-200 text-blue-600 font-bold uppercase rounded-md inline-flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" /> Profile PDF
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {staffSubTab === "DEPARTMENTS" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {departmentMetrics.map((dept) => (
                    <Card
                      key={dept.name}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs"
                    >
                      <CardHeader className="p-0 pb-2 border-b border-slate-100">
                        <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          {dept.name} Core Division
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 p-0 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500 uppercase">
                            Gross Allocations:
                          </span>
                          <span className="font-black text-slate-900">
                            {dept.total} Employees
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500 uppercase">
                            Active Status Pool:
                          </span>
                          <span className="font-black text-emerald-600">
                            {dept.active} Active
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {staffSubTab === "HISTORY" && (
                <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Complete Log Stream Hierarchy (Newest Swipes Filtered First)
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/60 border-b border-slate-200">
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Staff ID Code
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Calendar Date
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Day Matrix
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Logged Entry Time
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-500">
                          Punch Classification
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allHistoricalSwipes.slice(0, 50).map((swipe, idx) => (
                        <TableRow
                          key={idx}
                          className="border-b border-slate-100 font-mono text-xs"
                        >
                          <TableCell className="font-bold text-blue-600">
                            {swipe.id}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {swipe.date}
                          </TableCell>
                          <TableCell className="uppercase font-sans text-slate-500 font-bold">
                            {swipe.weekDay}
                          </TableCell>
                          <TableCell className="font-bold text-slate-900">
                            {swipe.time}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                swipe.type.toLowerCase().includes("in")
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[9px] uppercase font-bold"
                            >
                              {swipe.type}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                  <Card className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <CardHeader className="border-b border-slate-100 p-5 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-wide">
                          Add Employee
                        </CardTitle>
                        <CardDescription className="text-[11px] font-medium text-slate-400 uppercase mt-0.5">
                          Add a new team member to your database organization
                        </CardDescription>
                      </div>
                      <button
                        onClick={() => setIsAddModalOpen(false)}
                        className="text-slate-400 hover:text-slate-600 font-bold text-sm"
                      >
                        ✕
                      </button>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form
                        onSubmit={handleCreateStaffSubmit}
                        className="space-y-5"
                      >
                        {/* Row 1: Full Name & Staff Code (Primary Key) */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Full Name *
                            </label>
                            <Input
                              required
                              value={newStaffName} // Maps to schema: full_name
                              onChange={(e) => setNewStaffName(e.target.value)}
                              placeholder="e.g. MACKCHESTER BENFORD"
                              className="text-xs font-bold uppercase"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Employee ID Code * (Primary Key)
                            </label>
                            <Input
                              required
                              value={newStaffCode} // Maps to schema: staff_code
                              onChange={(e) => setNewStaffCode(e.target.value)}
                              placeholder="e.g. BA036"
                              className="text-xs font-bold uppercase"
                            />
                          </div>
                        </div>

                        {/* Row 2: Designation */}
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                            Job Designation *
                          </label>
                          <select
                            required
                            value={newStaffDesignation} // Maps to schema: designation
                            onChange={(e) =>
                              setNewStaffDesignation(e.target.value)
                            }
                            className="w-full bg-white border border-slate-200 text-xs font-bold uppercase rounded-lg h-9 px-3 text-slate-700 shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- SELECT DESIGNATION --</option>
                            <option value="Security Guard">
                              Security Guard
                            </option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Cleaner">Cleaner</option>
                            <option value="Production Assistant">
                              Production Assistant
                            </option>
                            <option value="General Fitter">
                              General Fitter
                            </option>
                            <option value="Merchandiser">Merchandiser</option>
                            <option value="Driver">Driver</option>
                          </select>
                        </div>

                        {/* Row 3: Department & Conditional Cost Center */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* DEPARTMENT */}
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Department *
                            </label>
                            <select
                              required
                              value={newStaffDept} // Maps to schema: department
                              onChange={(e) => {
                                setNewStaffDept(e.target.value);
                                setNewStaffCostCenter(""); // Reset dependent selection
                              }}
                              className="w-full bg-white border border-slate-200 text-xs font-bold uppercase rounded-lg h-9 px-3 text-slate-700 shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-- SELECT DEPARTMENT --</option>
                              <option value="Go Fresh Beef">
                                Go Fresh Beef
                              </option>
                              <option value="Go Fresh Chicken">
                                Go Fresh Chicken
                              </option>
                              <option value="Tray Factory">Tray Factory</option>
                              <option value="Live Sales">Live Sales</option>
                              <option value="Retail">Retail</option>
                            </select>
                          </div>

                          {/* CONDITIONAL COST CENTER */}
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Cost Center *
                            </label>
                            <select
                              required
                              value={newStaffCostCenter} // Maps to schema: cost_center
                              onChange={(e) =>
                                setNewStaffCostCenter(e.target.value)
                              }
                              disabled={!newStaffDept}
                              className="w-full bg-white border border-slate-200 text-xs font-bold uppercase rounded-lg h-9 px-3 text-slate-700 shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                              <option value="">-- SELECT COST CENTRE --</option>

                              {newStaffDept === "Go Fresh Beef" && (
                                <>
                                  <option value="Ngabu General">
                                    Ngabu General
                                  </option>
                                  <option value="Lilongwe LCS">
                                    Lilongwe LCS
                                  </option>
                                  <option value="Lilongwe Sales">
                                    Lilongwe Sales
                                  </option>
                                  <option value="Lilongwe Production">
                                    Lilongwe Production
                                  </option>
                                  <option value="Blantyre Sales">
                                    Blantyre Sales
                                  </option>
                                  <option value="Blantyre Production">
                                    Blantyre Production
                                  </option>
                                  <option value="Lilongwe House">
                                    Lilongwe House
                                  </option>
                                </>
                              )}

                              {newStaffDept === "Go Fresh Chicken" && (
                                <>
                                  <option value="Chicken Abattoir">
                                    Kanengo Farm
                                  </option>
                                  <option value="Chicken Abattoir">
                                    Chicken Abattoir
                                  </option>
                                  <option value="Lilongwe Sales">
                                    Lilongwe Sales
                                  </option>
                                  <option value="Lilongwe Production">
                                    Lilongwe Production
                                  </option>
                                  <option value="Blantyre Sales">
                                    Blantyre Sales
                                  </option>
                                  <option value="Live Sales Lilongwe">
                                    Live Sales Lilongwe
                                  </option>
                                  <option value="Lilongwe House">
                                    Lilongwe House
                                  </option>
                                </>
                              )}

                              {newStaffDept === "Tray Factory" && (
                                <>
                                  <option value="GF Tray Factory">
                                    GF Tray Factory
                                  </option>
                                </>
                              )}

                              {newStaffDept === "Live Sales" && (
                                <>
                                  <option value="Live Sales Lilongwe">
                                    Live Sales Lilongwe
                                  </option>
                                  <option value="Lilongwe Sales">
                                    Lilongwe Sales Production
                                  </option>
                                  <option value="Blantyre Production">
                                    Blantyre Production
                                  </option>
                                </>
                              )}

                              {newStaffDept === "Retail" && (
                                <>
                                  <option value="Lilongwe Sales">
                                    Lilongwe Sales
                                  </option>
                                  <option value="Blantyre Sales">
                                    Blantyre Sales
                                  </option>
                                  <option value="GF Retail">GF Retail</option>
                                </>
                              )}
                            </select>
                          </div>
                        </div>

                        {/* Action Row */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddModalOpen(false)}
                            className="text-xs font-bold uppercase h-9 rounded-lg"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase h-9 px-4 rounded-lg"
                          >
                            Save to Database
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === "REPORTS_HUB" && <AttendanceReportPage />}

          {activeTab === "SUMMARY" && <AttendanceDashboard />}

          {activeTab === "SETTINGS" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              {/* Left Column: Authorization Provision Engine */}
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl xl:col-span-1">
                <CardHeader>
                  <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    PROVISION SECURITY OPERATOR
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {provisionStatus && (
                    <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg uppercase block whitespace-pre-wrap">
                      {provisionStatus}
                    </div>
                  )}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                      Corporate Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="operator@gofresh.corp"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="text-xs font-bold border-slate-200 h-9"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                      Systemic Password Seed
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="text-xs font-bold border-slate-200 h-9"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                      Authorization Privilege Stratum
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2.5 uppercase text-slate-800"
                    >
                      <option value="operator">
                        Standard Operations Operator
                      </option>
                      <option value="manager">Control Manager Stratum</option>
                      <option value="admin">
                        System Administration Architecture
                      </option>
                    </select>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSuper}
                        onChange={(e) => setIsSuper(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      SUPERUSER FLAG
                    </label>
                  </div>
                  <Button
                    onClick={async () => {
                      setProvisionStatus(
                        "[PENDING] Executing user creation...",
                      );
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
                        setProvisionStatus(
                          `[SUCCESS] Created entry user target id: ${dat.userId}`,
                        );
                        setNewEmail("");
                        setNewPassword("");
                        fetchSystemUsers(); // Reload management grid automatically
                      } else {
                        setProvisionStatus(
                          `[ERROR] ${dat.error || "Execution failed."}`,
                        );
                      }
                    }}
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-lg tracking-wider"
                  >
                    PROVISION CREDENTIAL ENTITY
                  </Button>
                </CardContent>
              </Card>

              {/* Right Column: Active System Authorized Access Management Roster */}
              <div className="xl:col-span-2 space-y-6">
                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      AUTHORIZED SYSTEM ACCESS ACCOUNTS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingUsers ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-bold uppercase animate-pulse">
                        Retrieving security core accounts configuration...
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="text-[10px] font-black uppercase text-slate-500">
                              User Email Identifier
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500">
                              Privilege Role Tier
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right">
                              Revoke Account
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systemUsers.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="text-center py-6 text-xs text-slate-400 uppercase font-bold"
                              >
                                No secondary authorization records found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            systemUsers.map((sysUser) => (
                              <TableRow
                                key={sysUser.id}
                                className="border-b border-slate-100 hover:bg-slate-50/50"
                              >
                                <TableCell className="font-medium text-xs text-slate-900">
                                  {sysUser.email}
                                </TableCell>
                                <TableCell>
                                  <select
                                    value={sysUser.role}
                                    disabled={user?.id === sysUser.id} // Prevent accidental self-demotion
                                    onChange={(e) =>
                                      handleUpdateUserRole(
                                        sysUser.id,
                                        e.target.value,
                                      )
                                    }
                                    className="bg-slate-50 border border-slate-200 text-[11px] font-bold uppercase rounded p-1.5 focus:ring-1 focus:ring-blue-500 text-slate-700"
                                  >
                                    <option value="operator">OPERATOR</option>
                                    <option value="manager">MANAGER</option>
                                    <option value="ADMIN">ADMIN</option>
                                  </select>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={user?.id === sysUser.id} // Block self-deletion protection guard
                                    onClick={() =>
                                      handleDeleteSystemUser(sysUser.id)
                                    }
                                    className="h-7 text-[10px] border-rose-200 text-rose-600 hover:bg-rose-50 font-bold uppercase rounded-md inline-flex items-center gap-1"
                                  >
                                    <UserX className="w-3 h-3" /> Revoke
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      SYSTEM ARCHITECTURE RULES
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs font-medium text-slate-600">
                    <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-slate-900 block uppercase mb-0.5">
                          ADMINISTRATOR
                        </span>
                        Full schematic modification engine tracking schemas,
                        access keys context layer rules, database seeding
                        configurations and matrix ingestion blocks.
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-slate-900 block uppercase mb-0.5">
                          OPERATOR STRATUM
                        </span>
                        Standard read-only runtime feed monitoring view and
                        basic biometric file dropping actions.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      )}

      <footer className="p-6 max-w-7xl w-full mx-auto pt-0">
        <Card className="bg-white border border-slate-200 rounded-xl shadow-xs">
          <CardHeader className="py-2 px-4 border-b border-slate-100">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-blue-600" /> System Status Feed
              Notice
            </span>
          </CardHeader>
          <CardContent className="p-3">
            <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-[10px] text-slate-400 space-y-0.5">
              {systemLogs.map((log, index) => (
                <div key={index} className="truncate">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </footer>
    </div>
  );
}
