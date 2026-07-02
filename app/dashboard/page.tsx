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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
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
  CheckCircle2,
  LogOut,
  Terminal,
  Activity,
  UserPlus,
  CalendarDays,
  Settings,
  Briefcase,
  UserCheck,
  UserX,
  History,
  FileText,
  Filter,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingData, setIsSyncingData] = useState(true);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>(
    [],
  );
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);

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

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // 1. Add these interactive state lines at the top of your component alongside other active tabs
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string | null>(
    null,
  );
  const [drilldownTab, setDrilldownTab] = useState<
    "DESIGNATIONS" | "COST_CENTERS"
  >("DESIGNATIONS");

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
  const [isSubmittingManualAttendance, setIsSubmittingManualAttendance] = useState<string | null>(null);

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

  const handleCreateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffCode || !newStaffName) return;

    const payloadProfile: EmployeeProfile = {
      staffCode: newStaffCode.trim().toUpperCase(),
      fullName: newStaffName.trim().toUpperCase(),
      email: newStaffEmail.trim() || "no-email@company.com",
      designation: newStaffDesignation.trim() || "Worker",
      department: newStaffDept,
      costCenter: newStaffCostCenter,
      status: "Active",
      workType: newStaffWorkType,
    };

    setEmployeeDirectory((prev) => [...prev, payloadProfile]);
    setBavStatus({
      type: "success",
      message: `Successfully added ${payloadProfile.fullName} to the staff list!`,
    });
    addLog(`Registered brand new staff profile: ${payloadProfile.staffCode}`);

    setNewStaffCode("");
    setNewStaffName("");
    setNewStaffEmail("");
    setNewStaffDesignation("");
    setIsAddModalOpen(false);
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

  const getWeekdayLabel = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-US", { weekday: "long" });
  };

  const toggleDailyPresence = async (
    staffCode: string,
    isCurrentlyPresent: boolean,
  ) => {
    const dateStr = selectedDate;
    setSavingChecklistCode(staffCode);

    if (isCurrentlyPresent) {
      // Unchecking: remove today's punch pair for this employee
      const previousSwipes = rawSwipesBuffer;
      setRawSwipesBuffer((prev) =>
        prev.filter((s) => !(s.id === staffCode && s.date === dateStr)),
      );

      try {
        const response = await fetch(
          `/api/attendance?staffCode=${encodeURIComponent(staffCode)}&date=${encodeURIComponent(dateStr)}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("Delete request failed");
        addLog(
          `Marked ${staffCode} absent for ${dateStr} and synced the removal to Supabase.`,
        );
      } catch (err) {
        console.error(err);
        setRawSwipesBuffer(previousSwipes);
        addLog(
          `Could not sync absence for ${staffCode}. Reverted the checklist locally.`,
        );
      } finally {
        setSavingChecklistCode(null);
      }
      return;
    }

    // Checking: generate a standard 07:30 - 16:30 punch pair
    const weekDay = getWeekdayLabel(dateStr);
    const punchPair: RawSwipe[] = [
      {
        id: staffCode,
        date: dateStr,
        weekDay,
        time: "07:30",
        type: "Check In",
      },
      {
        id: staffCode,
        date: dateStr,
        weekDay,
        time: "16:30",
        type: "Check Out",
      },
    ];

    const previousSwipes = rawSwipesBuffer;
    setRawSwipesBuffer((prev) => [
      ...prev.filter((s) => !(s.id === staffCode && s.date === dateStr)),
      ...punchPair,
    ]);

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffCode,
          date: dateStr,
          weekDay,
          punches: punchPair,
        }),
      });
      if (!response.ok) throw new Error("Save request failed");
      addLog(
        `Marked ${staffCode} present for ${dateStr} (07:30 - 16:30) and synced to Supabase.`,
      );
    } catch (err) {
      console.error(err);
      setRawSwipesBuffer(previousSwipes);
      addLog(
        `Could not sync attendance for ${staffCode}. Reverted the checklist locally.`,
      );
    } finally {
      setSavingChecklistCode(null);
    }
  };

const systemProcessedDataset = useMemo(() => {
    const foundDates = Array.from(new Set(rawSwipesBuffer.map((s) => s.date)));
    const uniqueDates =
      foundDates.length > 0
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
        .map((emp) => emp.costCenter)
    );
    return Array.from(uniqueCCs);
  }, [checklistDept, systemProcessedDataset]);

  const handleMarkManualAttendance = async (staffCode: string, fullName: string) => {
    setIsSubmittingManualAttendance(staffCode);
    
    // Structure a standard manual "In" punch format
    const manualRecord = {
      id: staffCode,
      date: selectedDate, // Logs to the active date filter
      weekDay: new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long" }),
      time: new Date().toLocaleTimeString("en-US", { hour12: false }).slice(0, 5), // "HH:MM" format
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
        addLog(`[MANUAL OVERRIDE] Marked ${fullName} (${staffCode}) as Present at Remote Shop.`);

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

  const liveMetricsRollup = useMemo(() => {
    let onsite = 0;
    let missingClocks = 0;
    let onTime = 0;
    let late = 0;
    const missingTimeCapturers: string[] = [];

    const targetDateStr = selectedDate;

    systemProcessedDataset.forEach((emp) => {
      const dayRecords = rawSwipesBuffer.filter((s) => s.id === emp.staffCode);
      if (dayRecords.length === 0) {
        missingTimeCapturers.push(emp.fullName);
      }

      const todaySwipes = dayRecords.filter((s) => s.date === targetDateStr);
      if (todaySwipes.length > 0) {
        const checkIns = todaySwipes
          .filter((s) => s.type.toLowerCase().includes("in"))
          .sort((a, b) => a.time.localeCompare(b.time));
        const checkOuts = todaySwipes
          .filter((s) => s.type.toLowerCase().includes("out"))
          .sort((a, b) => a.time.localeCompare(b.time));

        if (checkIns.length > 0) {
          onsite++;
          if (checkIns[0].time <= "07:30") {
            onTime++;
          } else {
            late++;
          }
        }
        if (checkIns.length === 0 || checkOuts.length === 0) {
          missingClocks++;
        }
      } else {
        missingClocks++;
      }
    });

    return {
      onsite,
      missingClocks,
      onTime,
      late,
      notCapturingList: missingTimeCapturers,
    };
  }, [systemProcessedDataset, rawSwipesBuffer, selectedDate]);

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

  const dailyChecklistDataset = useMemo(() => {
    return employeeDirectory
      .filter(
        (emp) =>
          emp.fullName
            .toLowerCase()
            .includes(checklistSearchQuery.toLowerCase()) ||
          emp.staffCode
            .toLowerCase()
            .includes(checklistSearchQuery.toLowerCase()) ||
          emp.department
            .toLowerCase()
            .includes(checklistSearchQuery.toLowerCase()),
      )
      .map((emp) => {
        const daySwipes = rawSwipesBuffer.filter(
          (s) => s.id === emp.staffCode && s.date === selectedDate,
        );
        const checkIns = daySwipes
          .filter((s) => s.type.toLowerCase().includes("in"))
          .sort((a, b) => a.time.localeCompare(b.time));
        const checkOuts = daySwipes
          .filter((s) => s.type.toLowerCase().includes("out"))
          .sort((a, b) => a.time.localeCompare(b.time));
        return {
          ...emp,
          isPresent: daySwipes.length > 0,
          clockIn: checkIns.length > 0 ? checkIns[0].time : "—",
          clockOut:
            checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].time : "—",
        };
      });
  }, [employeeDirectory, rawSwipesBuffer, selectedDate, checklistSearchQuery]);

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

  const generateStaffScopeReport = (scope: string) => {
    addLog(`Preparing printing parameters for ${scope} generation profile...`);
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
              onClick={() => setActiveTab("EMPLOYEES")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "EMPLOYEES" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Contact2 className="w-4 h-4" /> Work Hours Sheet
            </button>
            <button
              onClick={() => setActiveTab("REPORTS_HUB")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "REPORTS_HUB" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <CalendarDays className="w-4 h-4" /> Print Reports
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

          {activeTab === "OVERVIEW" && (
            <>
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
                <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl shadow-xs shrink-0">
                  <label
                    htmlFor="dashboard-date-filter"
                    className="text-[10px] font-black uppercase text-slate-400 pl-1 tracking-wider"
                  >
                    Query Calendar:
                  </label>
                  <Input
                    id="dashboard-date-filter"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 text-xs font-bold border-none shadow-none focus-visible:ring-0 w-auto cursor-pointer p-0 pr-2 text-blue-600 bg-transparent uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-blue-600 shadow-xs">
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" /> At Work Today
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-slate-900 mt-1">
                      {liveMetricsRollup.onsite} Checked In
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-amber-500 shadow-xs">
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Total
                      Employees
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-slate-900 mt-1">
                      {liveMetricsRollup.missingClocks} Workers
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-emerald-500 shadow-xs">
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> On
                      Time Today (Before 07:30 AM)
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-emerald-600 mt-1">
                      {liveMetricsRollup.onTime} Workers
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-white border border-slate-200 rounded-xl border-l-4 border-l-rose-500 shadow-xs">
                  <CardHeader className="p-4">
                    <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-rose-500" /> Late Today
                      (After 07:30 AM)
                    </CardDescription>
                    <CardTitle className="text-xl font-black text-rose-600 mt-1">
                      {liveMetricsRollup.late} Workers
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
              {/* 🌟 CLICKABLE DEPARTMENT AND DRILLDOWN ENGINE */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Clickable Department List */}
                <Card className="bg-white border border-slate-200 rounded-xl shadow-xs">
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-500" />{" "}
                        Clickable Workspaces
                      </CardTitle>
                    </div>
                    {selectedDeptFilter && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedDeptFilter(null)}
                        className="h-6 text-[10px] uppercase font-bold text-rose-600 px-2 bg-rose-50 hover:bg-rose-100"
                      >
                        Clear Filter
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-2 divide-y divide-slate-100">
                    {departmentMetrics.map((dept) => {
                      const isSelected = selectedDeptFilter === dept.name;
                      return (
                        <div
                          key={dept.name}
                          onClick={() => setSelectedDeptFilter(dept.name)}
                          className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white font-black"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-2 h-2 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`}
                            />
                            <span className="text-xs font-bold uppercase tracking-wide">
                              {dept.name}
                            </span>
                          </div>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className="text-[10px] font-bold"
                          >
                            {dept.total} Employees
                          </Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Drilldown view showing employees categorized by Designations or Cost Centers */}
                <Card className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col">
                  <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div>
                      <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        {selectedDeptFilter
                          ? `${selectedDeptFilter} Workspace Roster`
                          : "Global Enterprise Metrics View"}
                      </CardTitle>
                    </div>

                    {/* Secondary Tab Switcher */}
                    <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-black uppercase">
                      <button
                        onClick={() => setDrilldownTab("DESIGNATIONS")}
                        className={`px-3 py-1.5 rounded-md transition-all ${drilldownTab === "DESIGNATIONS" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600"}`}
                      >
                        Designations
                      </button>
                      <button
                        onClick={() => setDrilldownTab("COST_CENTERS")}
                        className={`px-3 py-1.5 rounded-md transition-all ${drilldownTab === "COST_CENTERS" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600"}`}
                      >
                        Cost Centers
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 flex-1 overflow-y-auto max-h-[420px] space-y-6">
                    {/* Dynamically grouped view according to active tab mapping state logic */}
                    {(() => {
                      // Filter workers down to selected department if active
                      const dynamicStaffSelection =
                        systemProcessedDataset.filter(
                          (emp) =>
                            !selectedDeptFilter ||
                            emp.department === selectedDeptFilter,
                        );

                      // Group by either designation string or costCenter string
                      const groupingKey =
                        drilldownTab === "DESIGNATIONS"
                          ? "designation"
                          : "costCenter";
                      const groupedData: Record<
                        string,
                        typeof systemProcessedDataset
                      > = {};

                      dynamicStaffSelection.forEach((emp) => {
                        const groupName =
                          emp[groupingKey] || "Unassigned Category";
                        if (!groupedData[groupName])
                          groupedData[groupName] = [];
                        groupedData[groupName].push(emp);
                      });

                      if (Object.keys(groupedData).length === 0) {
                        return (
                          <div className="text-center py-12 text-xs font-medium text-slate-400 uppercase tracking-wider">
                            No active workspace workers match current filters.
                          </div>
                        );
                      }

                      return Object.entries(groupedData).map(
                        ([groupTitle, staffList]) => {
                          // Calculate quick summary statistics specifically for today's selected date context window
                          let onTimeCount = 0;
                          let lateCount = 0;
                          let absentCount = 0;
                          let onsiteCount = 0;

                          staffList.forEach((st) => {
                            const dayPunches = rawSwipesBuffer.filter(
                              (s) =>
                                s.id === st.staffCode &&
                                s.date === selectedDate,
                            );
                            const checkIns = dayPunches.filter((s) =>
                              s.type.toLowerCase().includes("in"),
                            );

                            if (dayPunches.length === 0) {
                              absentCount++;
                            } else if (checkIns.length > 0) {
                              onsiteCount++;
                              if (checkIns[0].time <= "07:30") onTimeCount++;
                              else lateCount++;
                            } else {
                              onsiteCount++; // Has records but missed clear "in" pair
                            }
                          });

                          return (
                            <div
                              key={groupTitle}
                              className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white"
                            >
                              {/* Group Header Metrics Banner */}
                              <div className="bg-slate-900 text-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                                  {groupTitle}
                                </span>

                                {/* Live Metrics Aggregation Tags */}
                                <div className="flex flex-wrap gap-1.5 text-[9px] font-black uppercase">
                                  <span className="px-2 py-0.5 bg-blue-500 rounded text-white">
                                    Onsite: {onsiteCount}
                                  </span>
                                  <span className="px-2 py-0.5 bg-emerald-600 rounded text-white">
                                    OnTime: {onTimeCount}
                                  </span>
                                  <span className="px-2 py-0.5 bg-amber-500 rounded text-slate-900">
                                    Late: {lateCount}
                                  </span>
                                  <span className="px-2 py-0.5 bg-rose-600 rounded text-white">
                                    Absent: {absentCount}
                                  </span>
                                </div>
                              </div>

                              {/* Grouped Employees Table Body */}
                              <Table>
                                <TableHeader className="bg-slate-50">
                                  <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">
                                      Staff ID
                                    </TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">
                                      Full Name
                                    </TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-right">
                                      Today's Status
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {staffList.map((worker) => {
                                    const workerTodayRecord =
                                      rawSwipesBuffer.filter(
                                        (s) =>
                                          s.id === worker.staffCode &&
                                          s.date === selectedDate,
                                      );
                                    const workerCheckIn =
                                      workerTodayRecord.find((s) =>
                                        s.type.toLowerCase().includes("in"),
                                      );

                                    let statusLabel = "ABSENT";
                                    let badgeColor:
                                      | "destructive"
                                      | "secondary"
                                      | "default" = "destructive";

                                    if (workerTodayRecord.length > 0) {
                                      if (workerCheckIn) {
                                        if (workerCheckIn.time <= "07:30") {
                                          statusLabel = `ON TIME (${workerCheckIn.time})`;
                                          badgeColor = "default";
                                        } else {
                                          statusLabel = `LATE (${workerCheckIn.time})`;
                                          badgeColor = "secondary";
                                        }
                                      } else {
                                        statusLabel = `MISSING CLOCK-IN (${workerTodayRecord.length} PUNCHES)`;
                                        badgeColor = "secondary";
                                      }
                                    }

                                    return (
                                      <TableRow
                                        key={worker.staffCode}
                                        className="hover:bg-slate-50/50"
                                      >
                                        <TableCell className="font-mono text-xs text-slate-600">
                                          {worker.staffCode}
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-slate-800 uppercase">
                                          {worker.fullName}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Badge
                                            className="text-[9px] font-black tracking-wide"
                                            variant={badgeColor}
                                          >
                                            {statusLabel}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          );
                        },
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <CardHeader className="p-4">
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Total Hours Worked Graph
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-60 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      {/* 🚀 Changed from BarChart to LineChart */}
                      <LineChart
                        data={systemProcessedDataset}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="fullName"
                          stroke="#94a3b8"
                          fontSize={9}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={9}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip />

                        {/* 🚀 Changed from Bar to Line with smooth monotone curve typing and node active dots */}
                        <Line
                          type="monotone"
                          dataKey="metrics.totalHoursSum"
                          name="Hours Accumulation"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                          activeDot={{
                            r: 5,
                            stroke: "#ffffff",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white border border-slate-200 rounded-xl shadow-xs">
                  <CardHeader className="p-4">
                    <CardTitle className="text-xs font-black text-rose-500 uppercase tracking-widest">
                      Workers With No Hours Logged
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-60 overflow-y-auto p-4 pt-0">
                    {liveMetricsRollup.notCapturingList.length === 0 ? (
                      <span className="text-xs text-slate-400 font-medium uppercase block py-2">
                        All employees have logged card entries safely.
                      </span>
                    ) : (
                      liveMetricsRollup.notCapturingList.map((name, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-rose-50 rounded-lg border border-rose-100 text-xs font-bold text-rose-800 flex justify-between items-center"
                        >
                          <span>{name}</span>
                          <Badge variant="destructive" className="text-[9px]">
                            0 HOURS
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {activeTab === "CHECKLIST" && (
            <div className="space-y-6">
              
              {/* Cascade Filter Control Board */}
              <Card className="bg-white border border-slate-200 shadow-xs rounded-xl">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-600" /> Operational Roster Checklist Controller
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase font-semibold text-slate-400 mt-0.5">
                        Isolate departments and cost-centers to punch remote shop workers into active tracking.
                      </CardDescription>
                    </div>
                    
                    {/* Active Ingestion Target Date Readout */}
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Target Shift Date</span>
                      <span className="text-xs font-mono font-black text-blue-600 uppercase">{selectedDate}</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                  {/* Step A: Choose Department */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">1. Select Target Department</label>
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
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Step B: Choose Cost Center (Conditioned on Dept selection) */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">2. Select Cost Center Workspace</label>
                    <select
                      value={checklistCostCenter}
                      disabled={!checklistDept}
                      onChange={(e) => setChecklistCostCenter(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2 uppercase text-slate-800 disabled:opacity-50 disabled:bg-slate-50 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Select Cost Center --</option>
                      {availableCostCenters.map((cc) => (
                        <option key={cc} value={cc}>{cc}</option>
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

              {/* Attendance Checklist Grid Output */}
              <Card className="bg-white border border-slate-200 shadow-xs rounded-xl overflow-hidden">
                <CardContent className="p-0">
                  {/* Filtering Evaluator Guard */}
                  {!checklistDept || !checklistCostCenter ? (
                    <div className="p-12 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                      ⚠️ Please specify an operational Department and secondary Cost Center parameters to fetch roster checklist.
                    </div>
                  ) : (() => {
                    // Extract filtered list of employees
                    const matchingEmployees = systemProcessedDataset.filter(
                      (emp) => emp.department === checklistDept && emp.costCenter === checklistCostCenter
                    );

                    if (matchingEmployees.length === 0) {
                      return (
                        <div className="p-12 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                          No personnel indices registered under this combination matrix.
                        </div>
                      );
                    }

                    return (
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-b border-slate-200">
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 w-32">Staff Code</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500">Employee Full Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500">Designation Assignment</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-center w-40">Presence Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right w-44">Checklist Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchingEmployees.map((worker) => {
                            // Detect if employee has any swipes recorded on the targeted date
                            const workerTodayRecord = rawSwipesBuffer.filter(
                              (s) => s.id === worker.staffCode && s.date === selectedDate
                            );
                            const isPresent = workerTodayRecord.length > 0;
                            const isPending = isSubmittingManualAttendance === worker.staffCode;

                            return (
                              <TableRow key={worker.staffCode} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="font-mono text-xs font-bold text-slate-600">{worker.staffCode}</TableCell>
                                <TableCell className="text-xs font-extrabold text-slate-900 uppercase">{worker.fullName}</TableCell>
                                <TableCell className="text-xs font-medium text-slate-500 uppercase">{worker.designation}</TableCell>
                                
                                {/* Status Indicator Column */}
                                <TableCell className="text-center">
                                  <Badge 
                                    className="text-[9px] font-black tracking-wide"
                                    variant={isPresent ? "secondary" : "destructive"}
                                  >
                                    {isPresent ? "CLOCKED / ONSITE" : "NOT CLOCKED"}
                                  </Badge>
                                </TableCell>
                                
                                {/* Checklist Interaction Mechanism */}
                                <TableCell className="text-right">
                                  {isPresent ? (
                                    <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 text-[10px] font-black uppercase px-2.5 py-1 rounded-md border border-emerald-200">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Present Lock
                                    </div>
                                  ) : (
                                    <label className="inline-flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 px-3 rounded-lg border border-slate-200 select-none bg-white transition-all active:scale-95">
                                      {isPending ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={false} // Always false since it turns into a locked present indicator once ticked
                                          onChange={() => handleMarkManualAttendance(worker.staffCode, worker.fullName)}
                                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                        />
                                      )}
                                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
                                        {isPending ? "Syncing..." : "Mark Present"}
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
                  })()}
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
                          Add a new team member to your organization
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Employee Name *
                            </label>
                            <Input
                              required
                              value={newStaffName}
                              onChange={(e) => setNewStaffName(e.target.value)}
                              placeholder="Sarah Chen"
                              className="text-xs font-bold uppercase"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Email (optional)
                            </label>
                            <Input
                              type="email"
                              value={newStaffEmail}
                              onChange={(e) => setNewStaffEmail(e.target.value)}
                              placeholder="sarah@company.com"
                              className="text-xs font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Employee ID Code *
                            </label>
                            <Input
                              required
                              value={newStaffCode}
                              onChange={(e) => setNewStaffCode(e.target.value)}
                              placeholder="e.g. GF-004"
                              className="text-xs font-bold uppercase"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Job Designation
                            </label>
                            <Input
                              value={newStaffDesignation}
                              onChange={(e) =>
                                setNewStaffDesignation(e.target.value)
                              }
                              placeholder="e.g. UX Designer"
                              className="text-xs font-bold uppercase"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Department
                            </label>
                            <select
                              value={newStaffDept}
                              onChange={(e) => setNewStaffDept(e.target.value)}
                              className="w-full bg-white border border-slate-200 text-xs font-bold uppercase rounded-lg h-9 p-2"
                            >
                              <option value="Operations">Operations</option>
                              <option value="Engineering">Engineering</option>
                              <option value="Design">Design</option>
                              <option value="Administration">
                                Administration
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                              Cost Center
                            </label>
                            <Input
                              value={newStaffCostCenter}
                              onChange={(e) =>
                                setNewStaffCostCenter(e.target.value)
                              }
                              placeholder="HQ"
                              className="text-xs font-bold uppercase"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">
                            Work Type
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {(["In Office", "Remote", "Hybrid"] as const).map(
                              (t) => (
                                <div
                                  key={t}
                                  onClick={() => setNewStaffWorkType(t)}
                                  className={`p-3 border rounded-xl cursor-pointer text-center transition-all ${newStaffWorkType === t ? "border-emerald-600 bg-emerald-50/40 text-emerald-900 font-bold" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"}`}
                                >
                                  <span className="text-[11px] uppercase block tracking-wider font-extrabold">
                                    {t}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
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
                            Add Employee
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === "EMPLOYEES" && (
            <Card className="bg-white border border-slate-200 rounded-xl shadow-xs">
              <CardHeader className="p-4 bg-slate-50/60 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Staff Members Work Hours Ledger
                  </CardTitle>
                  <div className="text-[10px] text-amber-700 font-bold uppercase mt-1">
                    Rule: If a worker checks in, they are given standard hours
                    for that day regardless of missing check-out.
                  </div>
                </div>
                <div>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-[10px] font-bold uppercase rounded p-1"
                  >
                    <option value="ALL">Show All Months</option>
                    {dynamicFilterMenus.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <TableHead className="text-[10px] font-black uppercase text-slate-500">
                        ID Code
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500">
                        Full Name
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500">
                        Department
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right">
                        Regular Work Hours
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right">
                        Overtime Hours
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right">
                        Total Hours Combined
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredViewDataset.map((emp) => (
                      <TableRow
                        key={emp.staffCode}
                        className="border-b border-slate-100 hover:bg-slate-50/50"
                      >
                        <TableCell className="font-mono text-xs font-bold text-slate-600">
                          {emp.staffCode}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-900">
                          {emp.fullName}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 uppercase">
                          {emp.department}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {emp.metrics.totalRegularHours} hours
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold text-blue-600">
                          +{emp.metrics.totalOvertimeHours} hours
                        </TableCell>
                        <TableCell className="text-xs text-right font-black text-slate-900">
                          {emp.metrics.totalHoursSum} hours
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === "REPORTS_HUB" && (
            <Card className="bg-white border border-slate-200 rounded-xl shadow-xs">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Download and Print PDF Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-slate-800 block">
                      Daily Sheet Report
                    </span>
                    <p className="text-[11px] uppercase text-slate-400 mt-1">
                      Saves a report containing only check-ins made today.
                    </p>
                  </div>
                  <Button
                    onClick={() => generateStaffScopeReport("DAILY")}
                    className="bg-blue-600 text-white font-bold text-xs uppercase h-9"
                  >
                    Download Daily PDF
                  </Button>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-slate-800 block">
                      Weekly Sheet Summary
                    </span>
                    <p className="text-[11px] uppercase text-slate-400 mt-1">
                      Saves a combined totals summary for this week's work
                      cycles.
                    </p>
                  </div>
                  <Button
                    onClick={() => generateStaffScopeReport("WEEKLY")}
                    className="bg-blue-600 text-white font-bold text-xs uppercase h-9"
                  >
                    Download Weekly PDF
                  </Button>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-slate-800 block">
                      Full Monthly Record Ledger
                    </span>
                    <p className="text-[11px] uppercase text-slate-400 mt-1">
                      Saves the entire month's clock ledger showing worker total
                      shifts.
                    </p>
                  </div>
                  <Button
                    onClick={() => generateStaffScopeReport("MONTHLY")}
                    className="bg-blue-600 text-white font-bold text-xs uppercase h-9"
                  >
                    Download Monthly PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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