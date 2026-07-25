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
  Building2,
  Terminal,
  UserPlus,
  CalendarDays,
  Settings,
  Briefcase,
  UserCheck,
  UserX,
  History,
  FileText,
  Loader2,
  LogOut,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AttendanceReportPage from "../overall/page";
import AttendanceDashboard from "../reports/page";
import Overview from "../overview/page";
import DailyChecklist from "../checklist/page";

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
  const [rightChrono, setRightChrono] = useState(true); // If referenced by your form
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
        body: JSON.stringify({ id, roleTier: role }),
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

  // Toggle a single permission flag (isSuperuser / canIngestChrono / canModifyRoster) on a user
  const handleToggleUserRight = async (
    id: string,
    field: "isSuperuser" | "canIngestChrono" | "canModifyRoster",
    value: boolean,
  ) => {
    try {
      const res = await fetch("/api/system-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`Updated ${field} to ${value} for system user`);
        fetchSystemUsers(); // Refresh the list
      } else {
        alert(data.error || "Failed to update permission");
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

   // Session User Email State
    const [sessionUserEmail, setSessionUserEmail] = useState<string>("");

     // Oparator User Email State
    const [operatorEmail, setOperatorEmail] = useState<string>("");

  // Fetch logged-in user email on mount
   useEffect(() => {
     let isMounted = true;
     const fetchLoggedInUser = async () => {
       try {
         const response = await fetch("/api/auth/me");
         if (response.ok) {
           const data = await response.json();
           if (isMounted && data?.user?.email) {
             setSessionUserEmail(data.user.email);
           }
         }
       } catch (error) {
         console.error("Failed to fetch logged-in user session:", error);
       }
     };
 
     fetchLoggedInUser();
     return () => {
       isMounted = false;
     };
   }, []);
 
   // Determine active operator email with fallback order: Session Email -> Prop -> Default
   const activeOperatorEmail = useMemo(() => {
     return sessionUserEmail || operatorEmail || "OPERATOR_CHECKLIST_OVERRIDE";
   }, [sessionUserEmail, operatorEmail]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [workersDataset, setWorkersDataset] = useState<EmployeeProfile[]>([]);

  // Helper logic to get the full week range matching a specific date anchor string

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
              designation:
                designationIdx !== -1 && row[designationIdx]
                  ? String(row[designationIdx]).trim()
                  : "Operator",
              department:
                departmentIdx !== -1 && row[departmentIdx]
                  ? String(row[departmentIdx]).trim()
                  : "Operations",
              costCenter:
                costCenterIdx !== -1 && row[costCenterIdx]
                  ? String(row[costCenterIdx]).trim()
                  : "Main Barn",
            });
          });

          if (cleanEmployees.length === 0) {
            throw new Error(
              "No valid personnel metadata lines could be matched.",
            );
          }

          addLog(
            `Uploading ${cleanEmployees.length} clean employee registry records to database transaction...`,
          );

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
            addLog(
              `Successfully synchronized ${cleanEmployees.length} employee profiles to backend records.`,
            );
          } else {
            alert(
              `Roster Sync Failed: ${result.error || "Server transaction rejected."}`,
            );
            addLog(
              `[ROSTER API ERROR]: ${result.error || "Batch payload rejected."}`,
            );
          }
        } else {
          alert(
            "Invalid roster format. Could not locate required columns: 'Staff Code' and 'Full Name'.",
          );
          addLog("Spreadsheet validation failed: Target anchors missing.");
        }
      } catch (err: any) {
        console.error("Bulk Roster Upload Error Context:", err);
        alert(
          `Process Error: ${err.message || "Failed reading sheet rows safely."}`,
        );
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
            dayStatus = "LATE";
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
  }, [employeeDirectory, rawSwipesBuffer, monthFilter, selectedDate]);

  // Derive dynamic list of Cost Centers based on selected department to avoid dead-ends

  // Handle logging out the user
  const handleSignOut = async () => {
    try {
      addLog("[AUTH] Terminating secure user session...");
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) {
        router.push("/");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      addLog(`[ERROR] Logout request failed: ${err.message}`);
      router.push("/");
    }
  };

  // 2️⃣ PLACE THIS SECOND (liveMetricsRollup)
  // Computes base operational counts strictly dynamic to selected Department & Cost Center selection

  // Comprehensive analytics parsing utilizing standard 8.5 hour shift caps across entire calendar week row structures

  // Master layout structural logic dynamic to selected interactive metrics indicators

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

          const payload = {
            operatorEmail: activeOperatorEmail,
            records: dynamicSwipes,
          };

          // 🚀 CONNECTED PIPELINE: Sync with your new Prisma Batch route
          const response = await fetch("/api/attendance/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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

  const departmentsList = useMemo(() => {
    return Array.from(
      new Set(employeeDirectory.map((emp) => emp.department)),
    ).filter(Boolean);
  }, [employeeDirectory]);

  const costCentersList = useMemo(() => {
    return Array.from(
      new Set(employeeDirectory.map((emp) => emp.costCenter)),
    ).filter(Boolean);
  }, [employeeDirectory]);

  // Map EmployeeProfile[] -> Employee[]
  const mappedEmployees = useMemo(() => {
    return employeeDirectory.map((emp) => ({
      id: emp.staffCode,
      name: emp.fullName,
      ...emp,
    }));
  }, [employeeDirectory]);

  // Map RawSwipe[] -> AttendanceRecord[]
  const mappedAttendanceRecords = useMemo(() => {
    return rawSwipesBuffer.map((swipe) => ({
      employeeId: swipe.id,
      status: swipe.type.toLowerCase().includes("in") ? "PRESENT" : "ABSENT",
      ...swipe,
    }));
  }, [rawSwipesBuffer]);

  const handleRefresh = async () => {
    try {
      const response = await fetch(`/api/attendance?page=0&size=2500`);
      if (response.ok) {
        const payload = await response.json();
        setRawSwipesBuffer(payload.swipes || []);
        addLog("Refreshed daily checklist attendance records.");
      }
    } catch (err) {
      console.error("Failed to refresh attendance records:", err);
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
              <UserCheck className="w-4 h-4" /> Manual Checklist
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
              <CalendarDays className="w-4 h-4 text-blue-600" /> Summary
            </button>
            <button
              onClick={() => setActiveTab("SUMMARY")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${activeTab === "SUMMARY" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Terminal className="w-4 h-4" /> Labour
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
                <span>{isUploading ? "Reading..." : "Timecard"}</span>
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
                    {isBulkEmployeeUploading ? "Reading..." : "Employees"}
                  </span>
                </label>
              </Button>
            </div>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="h-9 px-3 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs font-bold rounded-lg shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
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

          {/* ========================================== OVERVIEW TAB CONTENT ========================================== */}
          {activeTab === "OVERVIEW" && <Overview />}

          {activeTab === "CHECKLIST" && (
            <DailyChecklist
              employees={mappedEmployees || []}
              attendanceRecords={mappedAttendanceRecords || []}
              departments={departmentsList || []}
              costCenters={costCentersList || []}
              onRefreshDashboard={handleRefresh}
            />
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
                          Manually enroll a new team member directly into the
                          workspace registry directory pipeline.
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setIsAddModalOpen(false)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
                      >
                        ✕
                      </Button>
                    </CardHeader>

                    <form onSubmit={handleCreateStaffSubmit}>
                      <CardContent className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">
                              Staff Code ID *
                            </label>
                            <Input
                              required
                              value={newStaffCode}
                              onChange={(e) => setNewStaffCode(e.target.value)}
                              placeholder="e.g. GF109"
                              className="h-9 text-xs font-bold uppercase"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">
                              Full Corporate Name *
                            </label>
                            <Input
                              required
                              value={newStaffName}
                              onChange={(e) => setNewStaffName(e.target.value)}
                              placeholder="FIRSTNAME LASTNAME"
                              className="h-9 text-xs font-bold uppercase"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">
                            Corporate Designation *
                          </label>
                          <Input
                            required
                            value={newStaffDesignation}
                            onChange={(e) =>
                              setNewStaffDesignation(e.target.value)
                            }
                            placeholder="e.g. Field Enforcement Officer"
                            className="h-9 text-xs font-bold uppercase"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">
                              Assigned Department *
                            </label>
                            <select
                              value={newStaffDept}
                              onChange={(e) => setNewStaffDept(e.target.value)}
                              className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2 h-9 uppercase text-slate-800 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="Operations">Operations</option>
                              <option value="Administration">
                                Administration
                              </option>
                              <option value="Engineering">Engineering</option>
                              <option value="Design">Design</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">
                              Cost Center Assignment *
                            </label>
                            <select
                              value={newStaffCostCenter}
                              onChange={(e) =>
                                setNewStaffCostCenter(e.target.value)
                              }
                              className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2 h-9 uppercase text-slate-800 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="Main Barn">Main Barn</option>
                              <option value="Front Office">Front Office</option>
                              <option value="Workshop">Workshop</option>
                              <option value="HQ">HQ</option>
                              <option value="Remote Hub">Remote Hub</option>
                            </select>
                          </div>
                        </div>
                      </CardContent>

                      <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddModalOpen(false)}
                          className="h-9 text-xs font-bold uppercase px-4 rounded-lg"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase px-4 rounded-lg inline-flex items-center gap-1"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <span>Register Employee</span>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === "REPORTS_HUB" && (
            <div className="space-y-6">
              <AttendanceDashboard />
            </div>
          )}

          {activeTab === "SUMMARY" && (
            <div className="space-y-6">
              <AttendanceReportPage />
            </div>
          )}

          {activeTab === "SETTINGS" && (
            <div className="space-y-6">
              <Card className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
                  <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-600" />{" "}
                    Administrative Access Configuration Layer
                  </CardTitle>
                  <CardDescription className="text-[10px] font-semibold text-slate-400 uppercase mt-0.5">
                    Provision secure workspace system access, update
                    credentials, and audit operators.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="space-y-4 max-w-xl">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1">
                      Provision New System Account
                    </h3>

                    {provisionStatus && (
                      <div className="p-3 bg-blue-50 text-blue-800 border border-blue-200 font-bold uppercase rounded-lg text-[11px]">
                        {provisionStatus}
                      </div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setProvisionStatus("Configuring system access keys...");
                        try {
                          const payload = {
                            email: newEmail.trim().toLowerCase(),
                            password: newPassword,
                            roleTier: newRole,
                            isSuperuser: isSuper,
                            canIngestChrono: rightChrono,
                            canModifyRoster: rightRoster,
                          };

                          const res = await fetch("/api/system-users", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          });
                          const data = await res.json();

                          if (res.ok && data.success) {
                            setProvisionStatus(
                              `[SUCCESS]: Authorized account created for ${data.user.email}`,
                            );
                            addLog(
                              `Provisioned access keys for operator agent: ${data.user.email}`,
                            );
                            setNewEmail("");
                            setNewPassword("");
                            setIsSuper(false);
                            setRightChrono(true);
                            setRightRoster(false);
                            fetchSystemUsers();
                          } else {
                            setProvisionStatus(
                              `[FAILURE]: ${data.error || "Transaction rejected."}`,
                            );
                          }
                        } catch (err: any) {
                          setProvisionStatus(`[ERROR]: ${err.message}`);
                        }
                      }}
                      className="space-y-3 text-xs"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                            Account Email Address
                          </label>
                          <Input
                            required
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="operator@gofreshmw.com"
                            className="h-9 text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                            Temporary System Password
                          </label>
                          <Input
                            required
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="h-9 text-xs font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-center pt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                            Functional Role Tier
                          </label>
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg p-2 h-9 uppercase text-slate-700 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="operator">System Operator</option>
                            <option value="admin">System Admin</option>
                            <option value="manager">Operations Manager</option>
                            <option value="auditor">Compliance Auditor</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-4 h-full pt-4">
                          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSuper}
                              onChange={(e) => setIsSuper(e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">
                              Superuser Controls
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-center pt-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rightChrono}
                            onChange={(e) => setRightChrono(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">
                            Can Ingest Chrono
                          </span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rightRoster}
                            onChange={(e) => setRightRoster(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">
                            Can Modify Roster
                          </span>
                        </label>
                      </div>

                      <div className="pt-3">
                        <Button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider text-[11px] px-4 h-9 rounded-lg shadow-xs"
                        >
                          Commit Roster Authorization Keys
                        </Button>
                      </div>
                    </form>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1">
                      Active Authorized Administrators & Operators Pool
                    </h3>
                    <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="text-[10px] font-black uppercase text-slate-500">
                              System Identity Account
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500">
                              Database Prim Key ID
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500">
                              Role Authority Level
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-center">
                              Superuser
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-center">
                              Ingest Chrono
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-center">
                              Modify Roster
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right">
                              Revoke Access Control
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoadingUsers ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center p-4 text-xs font-bold uppercase text-slate-400"
                              >
                                Synchronizing system user tables...
                              </TableCell>
                            </TableRow>
                          ) : systemUsers.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center p-4 text-xs font-bold uppercase text-slate-400"
                              >
                                No secondary operator keys found in the system
                                registry cluster.
                              </TableCell>
                            </TableRow>
                          ) : (
                            systemUsers.map((su) => (
                              <TableRow
                                key={su.id}
                                className="border-b border-slate-100 hover:bg-slate-50/50 text-xs"
                              >
                                <TableCell>
                                  <div className="font-bold text-slate-900">
                                    {su.email}
                                  </div>
                                  {su.isSuperuser && (
                                    <Badge className="bg-blue-600 text-[8px] tracking-widest font-black uppercase px-1.5 py-0 mt-0.5 rounded">
                                      SUPERUSER ROOT
                                    </Badge>
                                  )}
                                </TableCell>
                                <td className="p-3 font-mono font-bold text-slate-400">
                                  {su.id}
                                </td>
                                <TableCell>
                                  <select
                                    value={su.roleTier}
                                    onChange={(e) =>
                                      handleUpdateUserRole(
                                        su.id,
                                        e.target.value,
                                      )
                                    }
                                    className="bg-white border border-slate-200 text-[11px] font-bold rounded-md p-1 px-2 uppercase text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                  >
                                    <option value="operator">operator</option>
                                    <option value="manager">manager</option>
                                    <option value="auditor">auditor</option>
                                  </select>
                                </TableCell>
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!su.isSuperuser}
                                    onChange={(e) =>
                                      handleToggleUserRight(
                                        su.id,
                                        "isSuperuser",
                                        e.target.checked,
                                      )
                                    }
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!su.canIngestChrono}
                                    onChange={(e) =>
                                      handleToggleUserRight(
                                        su.id,
                                        "canIngestChrono",
                                        e.target.checked,
                                      )
                                    }
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!su.canModifyRoster}
                                    onChange={(e) =>
                                      handleToggleUserRight(
                                        su.id,
                                        "canModifyRoster",
                                        e.target.checked,
                                      )
                                    }
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    onClick={() =>
                                      handleDeleteSystemUser(su.id)
                                    }
                                    variant="outline"
                                    className="h-7 border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold text-[10px] uppercase rounded-md tracking-wider shadow-2xs"
                                  >
                                    Revoke Access Account
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      )}

      <footer className="mt-auto bg-white border-t border-slate-200 p-4">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-2 rounded-xl w-full sm:w-auto overflow-hidden">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-blue-600" /> Active Console
              Logs:
            </span>
            <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-none font-mono text-[11px] text-slate-600 font-bold uppercase tracking-tight">
              {systemLogs.map((log, index) => (
                <span key={index} className="opacity-80">
                  {log}
                </span>
              ))}
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-right shrink-0">
            TIMENOX CORE PARSER ENGINE v2.4.0
          </span>
        </div>
      </footer>
    </div>
  );
}
