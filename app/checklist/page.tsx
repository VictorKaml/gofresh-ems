"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  FileText,
  BarChart3,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileEdit,
  Users,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
  Filter,
  UserX,
  Loader2,
  PartyPopper,
  Mail,
  CalendarDays,
  RotateCcw,
} from "lucide-react";

interface Employee {
  staffCode: string;
  fullName: string;
  id?: string;
  name?: string;
  department?: string;
  costCenter?: string;
  [key: string]: any;
}

interface EmployeeProfile {
  staffCode: string;
  fullName: string;
  department: string;
  costCenter: string;
  subCenter: string;
  subItem: string;
  id?: string;
  name?: string;
}

interface AttendanceRecord {
  id?: string;
  staffCode?: string;
  type?: string;
  swipe_type?: string;
  date?: string;
  swipe_date?: string;
  time?: string;
  swipe_time?: string;
  employeeId?: string;
  status?: string;
  adjusted_by?: string;
  adjustedBy?: string;
  operatorEmail?: string;
  operator_email?: string;
  created_by?: string;
  updated_by?: string;
  reason?: string;
  change_reason?: string;
  [key: string]: any;
}

interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

interface SystemUserLite {
  id?: string;
  email: string;
  isSuperuser?: boolean;
  department?: string | null;
  costCenter?: string | null;
  [key: string]: any;
}

interface OperatorScope {
  isSuperuser: boolean;
  department: string | null;
  costCenter: string | null;
}

interface Props {
  employees?: Employee[];
  attendanceRecords?: AttendanceRecord[];
  departments?: string[];
  costCenters?: string[];
  operatorEmail?: string;
  onRefreshDashboard: () => void;
  onDownloadExceptionReport?: (group: string) => void;
  onDownloadOverallAnalytics?: (dept: string, costCenter: string) => void;
  publicHolidays?: PublicHoliday[];
  systemUsers?: SystemUserLite[];
}

const OVERRIDE_REASONS = [
  "Biometric / Card Reader Failure",
  "Approved Field Duty / Onsite Work",
  "Manual Attendance Form Approved",
  "Official Travel / Duty Out of Station",
  "Management Override / Special Approval",
  "Sick Leave",
  "Annual Leave",
];

// Leave codes used when marking an employee as away from work rather than
// logging an actual IN/OUT punch pair.
const LEAVE_TYPES: { code: "SK" | "AL"; label: string }[] = [
  { code: "SK", label: "Sick Leave" },
  { code: "AL", label: "Annual Leave" },
];

const DailyChecklist: React.FC<Props> = ({
  employees = [],
  attendanceRecords = [],
  departments = [],
  costCenters = [],
  operatorEmail,
  onRefreshDashboard,
  publicHolidays = [],
  systemUsers = [],
}) => {
  // Session User Email State
  const [sessionUserEmail, setSessionUserEmail] = useState<string>("");

  // Live operator scope (department / cost center / superuser status)
  const [operatorScope, setOperatorScope] = useState<OperatorScope | null>(
    null,
  );

  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>(
    [],
  );
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);

  useEffect(() => {
    async function fetchEmployees() {
      setIsLoadingEmployees(true);
      try {
        const res = await fetch("/api/employees");
        if (res.ok) {
          const data = await res.json();
          setEmployeeDirectory(
            Array.isArray(data) ? data : data.employees || [],
          );
        }
      } catch (err) {
        console.error("Failed fetching employee directory", err);
      } finally {
        setIsLoadingEmployees(false);
      }
    }
    fetchEmployees();
  }, []);

  // Fetch logged-in user email + scope on mount
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
          if (isMounted && data?.user) {
            setOperatorScope({
              isSuperuser: !!data.user.superuser,
              department: data.user.department ?? null,
              costCenter: data.user.costCenter ?? null,
            });
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

  // Determine active operator email with fallback order
  const activeOperatorEmail = useMemo(() => {
    return sessionUserEmail || operatorEmail || "OPERATOR_CHECKLIST_OVERRIDE";
  }, [sessionUserEmail, operatorEmail]);

  // Local ISO date formatter helper (YYYY-MM-DD)
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Public Holidays lookup map, keyed by YYYY-MM-DD
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, PublicHoliday>();
    (publicHolidays || []).forEach((h) => {
      if (h && h.date) map.set(h.date, h);
    });
    return map;
  }, [publicHolidays]);

  // Resolve a stored "confirmed by" value with robust fallbacks
  const resolveConfirmedByEmail = (rawValue: string | undefined | null) => {
    if (!rawValue) return "System / Biometric Reader";

    const trimmed = String(rawValue).trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
      return "System / Biometric Reader";
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return trimmed;
    }

    if (Array.isArray(systemUsers) && systemUsers.length > 0) {
      const matchedUser = systemUsers.find(
        (su) =>
          String(su.id).toLowerCase() === trimmed.toLowerCase() ||
          String(su.email).toLowerCase() === trimmed.toLowerCase(),
      );
      if (matchedUser?.email) return matchedUser.email;
    }

    return trimmed;
  };

  // Filter States
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>("");
  const [selectedSubCenter, setSelectedSubCenter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);

  // Multi-Employee Selection Set
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    new Set(),
  );

  // Multi-Date Selection Set
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    new Set([todayStr]),
  );

  // Modal State for Previewing
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Safely memoize source list across directory and employees prop
  const activeEmployeeSource = useMemo(() => {
    return employeeDirectory && employeeDirectory.length > 0
      ? employeeDirectory
      : employees || [];
  }, [employeeDirectory, employees]);

  // Available Cost Centers based on selected department (SAFE FROM UNDEFINED)
  const availableCostCenters = useMemo(() => {
    if (!selectedDept) return costCenters || [];
    const filteredCCs = activeEmployeeSource
      .filter((emp: any) => emp?.department === selectedDept && emp?.costCenter)
      .map((emp: any) => emp.costCenter as string);
    return Array.from(new Set(filteredCCs));
  }, [selectedDept, activeEmployeeSource, costCenters]);

  // Available Subcenters based on selected department and/or cost center
  const availableSubcenters = useMemo(() => {
    const filteredSubcenters = activeEmployeeSource
      .filter((emp: any) => {
        const matchesDept = !selectedDept || emp?.department === selectedDept;
        const matchesCC =
          !selectedCostCenter || emp?.costCenter === selectedCostCenter;
        const subCenterVal = emp?.subCenter || emp?.subcenter;
        return matchesDept && matchesCC && subCenterVal;
      })
      .map((emp: any) => (emp.subCenter || emp.subcenter) as string);

    return Array.from(new Set(filteredSubcenters));
  }, [selectedDept, selectedCostCenter, activeEmployeeSource]);

  const handleDepartmentChange = (dept: string) => {
    setSelectedDept(dept);
    setSelectedCostCenter("");
    setSelectedSubCenter("");
  };

  useEffect(() => {
    if (operatorScope && !operatorScope.isSuperuser) {
      setSelectedDept(operatorScope.department || "");
      setSelectedCostCenter(operatorScope.costCenter || "");
    }
  }, [operatorScope]);

  const isScopeLocked = !!operatorScope && !operatorScope.isSuperuser;

  // Calendar & Punch Form States
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [checkInTime, setCheckInTime] = useState<string>("07:30");
  const [checkOutTime, setCheckOutTime] = useState<string>("16:30");
  const [auditReason, setAuditReason] = useState<string>(OVERRIDE_REASONS[0]);

  // Batch entry mode: log an actual IN/OUT punch pair, or mark the employee(s)
  // as on leave (SK = Sick Leave, AL = Annual Leave) for the selected date(s).
  const [attendanceMode, setAttendanceMode] = useState<"PUNCH" | "LEAVE">(
    "PUNCH",
  );
  const [leaveType, setLeaveType] = useState<"SK" | "AL">("SK");

  // Keep the audit/change reason in sync with the chosen leave type whenever
  // Leave mode is active, so the change_reason saved to the DB always reads
  // "Sick Leave" / "Annual Leave" without requiring a separate manual pick.
  useEffect(() => {
    if (attendanceMode === "LEAVE") {
      const matchingReason = LEAVE_TYPES.find(
        (lt) => lt.code === leaveType,
      )?.label;
      if (matchingReason) setAuditReason(matchingReason);
    }
  }, [attendanceMode, leaveType]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Check if any selected date is in the future
  const selectedFutureDates = useMemo(() => {
    return Array.from(selectedDates).filter((d) => d > todayStr);
  }, [selectedDates, todayStr]);

  const hasFutureDateSelected = selectedFutureDates.length > 0;

  // Selected dates sorted chronologically
  const sortedSelectedDates = useMemo(() => {
    return Array.from(selectedDates).sort();
  }, [selectedDates]);

  // Base Match Function for Search, Dept, CostCenter, and SubCenter filters
  const matchesFilter = (emp: any) => {
    if (!emp) return false;
    const matchesDept = !selectedDept || emp.department === selectedDept;
    const matchesCC =
      !selectedCostCenter || emp.costCenter === selectedCostCenter;

    // Check both property name variants
    const empSubCenter = emp.subCenter || emp.subcenter;
    const matchesSubCenter =
      !selectedSubCenter || empSubCenter === selectedSubCenter;

    const name = (emp.fullName || emp.name || "").toString();
    const id = (emp.staffCode || emp.id || "").toString();
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSelection =
      !showOnlySelected || selectedEmployeeIds.has(id);

    return (
      matchesDept &&
      matchesCC &&
      matchesSubCenter &&
      matchesSearch &&
      matchesSelection
    );
  };

  // Search-matched employees list
  const searchMatchedEmployees = useMemo(() => {
    return activeEmployeeSource.filter(matchesFilter);
  }, [activeEmployeeSource, selectedDept, selectedCostCenter, selectedSubCenter, searchQuery, showOnlySelected, selectedEmployeeIds]);

  const displayedEmployees = useMemo(() => {
    return activeEmployeeSource.filter(matchesFilter);
  }, [
    activeEmployeeSource,
    selectedDept,
    selectedCostCenter,
    selectedSubCenter,
    searchQuery,
    showOnlySelected,
    selectedEmployeeIds,
  ]);

  // Selected Employee Objects Array
  const selectedEmployeeList = useMemo(() => {
    return activeEmployeeSource.filter((emp: any) => {
      const id = String(emp.staffCode || emp.id);
      return selectedEmployeeIds.has(id);
    });
  }, [activeEmployeeSource, selectedEmployeeIds]);

  // Multi-date Attendance Record Conflict Checking
  const employeesWithCompleteRecords = useMemo(() => {
    if (selectedDates.size === 0 || selectedEmployeeIds.size === 0) return [];

    const conflicts: Array<{
      employee: Employee;
      confirmedBy: string;
      date: string;
    }> = [];

    selectedEmployeeList?.forEach((emp) => {
      const empId = String(emp.staffCode || emp.id);

      selectedDates.forEach((targetDate) => {
        const dateRecords =
          (attendanceRecords || []).filter((rec) => {
            const recDate = rec.date || rec.swipe_date;
            return recDate === targetDate;
          }) || [];

        const empRecords = dateRecords.filter((rec) => {
          const rEmpId = String(rec.staffCode || rec.employeeId || rec.id);
          return rEmpId === empId;
        });

        const hasIn = empRecords.some((r) => (r.type || r.swipe_type) === "IN");
        const hasOut = empRecords.some(
          (r) => (r.type || r.swipe_type) === "OUT",
        );

        if (hasIn && hasOut) {
          const recordWithOperator = empRecords.find((r) => {
            const val =
              r.adjusted_by ||
              r.adjustedBy ||
              r.operatorEmail ||
              r.operator_email ||
              r.created_by ||
              r.updated_by;
            return (
              val &&
              String(val).trim() !== "" &&
              String(val) !== "SYSTEM_INGEST_CHRONO"
            );
          });

          const confirmedByRaw =
            recordWithOperator?.adjusted_by ||
            recordWithOperator?.adjustedBy ||
            recordWithOperator?.operatorEmail ||
            recordWithOperator?.operator_email ||
            recordWithOperator?.created_by ||
            recordWithOperator?.updated_by;

          const confirmedBy = resolveConfirmedByEmail(confirmedByRaw);

          conflicts.push({
            employee: emp,
            confirmedBy,
            date: targetDate,
          });
        }
      });
    });

    return conflicts;
  }, [
    selectedDates,
    selectedEmployeeList,
    attendanceRecords,
    selectedEmployeeIds,
    systemUsers,
  ]);

  const hasConflictingRecords = employeesWithCompleteRecords.length > 0;

  // Quick action to remove conflicting employees from selection
  const handleRemoveConflictingEmployees = () => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      employeesWithCompleteRecords.forEach((c) => {
        const empId = String(c.employee.staffCode || c.employee.id);
        next.delete(empId);
      });
      return next;
    });
  };

  // Toggle multi-date selection
  const toggleDateSelection = (dateStr: string) => {
    if (dateStr > todayStr) return;

    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        if (next.size > 1) {
          next.delete(dateStr);
        }
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  // Select all past workdays in current month
  const handleSelectPastWorkdaysInMonth = () => {
    const next = new Set<string>();
    daysInMonth.forEach((day) => {
      const dateStr = formatLocalDate(day);
      const dayOfWeek = day.getDay();
      if (dateStr <= todayStr && dayOfWeek !== 0 && dayOfWeek !== 6) {
        next.add(dateStr);
      }
    });
    if (next.size > 0) setSelectedDates(next);
  };

  // Clear extra selected dates back to today
  const handleResetDatesToToday = () => {
    setSelectedDates(new Set([todayStr]));
  };

  // Check if all search-matched employees are selected
  const isAllFilteredSelected = useMemo(() => {
    if (searchMatchedEmployees.length === 0) return false;
    return searchMatchedEmployees.every((emp) =>
      selectedEmployeeIds.has(String(emp.staffCode || emp.id)),
    );
  }, [searchMatchedEmployees, selectedEmployeeIds]);

  // Single Selection Toggle
  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select / Deselect All Filtered Employees
  const toggleSelectAllFiltered = () => {
    const matchedIds = searchMatchedEmployees.map((emp) =>
      String(emp.staffCode || emp.id),
    );

    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        matchedIds.forEach((id) => next.delete(id));
      } else {
        matchedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Clear All Selections
  const handleClearAllSelections = () => {
    setSelectedEmployeeIds(new Set());
    setShowOnlySelected(false);
  };

  // Calendar Days & Offset Computation
  const { daysInMonth, firstDayOfWeek } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const dayOfWeekIndex = firstDay.getDay();

    const days = [];
    const tempDate = new Date(year, month, 1);
    while (tempDate.getMonth() === month) {
      days.push(new Date(tempDate));
      tempDate.setDate(tempDate.getDate() + 1);
    }

    return { daysInMonth: days, firstDayOfWeek: dayOfWeekIndex };
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  // Batch Submit Multi-Date & Multi-Employee Attendance
  const handleBatchConfirmAttendance = async () => {
    if (
      selectedEmployeeList.length === 0 ||
      selectedDates.size === 0 ||
      (attendanceMode === "PUNCH" && hasConflictingRecords)
    )
      return;

    if (hasFutureDateSelected) {
      setNotification({
        type: "error",
        message: "Future dates cannot be logged.",
      });
      return;
    }

    if (!auditReason.trim()) {
      setNotification({
        type: "error",
        message: "Please select a reason before confirming attendance.",
      });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    const batchRecords: any[] = [];

    if (attendanceMode === "LEAVE") {
      // Leave marking: a single record per employee per selected date, using
      // the leave code (SK/AL) as the swipe type instead of an IN/OUT pair.
      const leaveLabel =
        LEAVE_TYPES.find((lt) => lt.code === leaveType)?.label || leaveType;

      sortedSelectedDates.forEach((targetDate) => {
        const dateObj = new Date(`${targetDate}T00:00:00`);
        const weekDayName = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
        });

        selectedEmployeeList.forEach((emp) => {
          const staffId = emp.staffCode || emp.id;

          batchRecords.push({
            id: staffId,
            staffCode: staffId,
            date: targetDate,
            weekday: weekDayName,
            time: "00:00:00",
            type: leaveType,
            isManualOverride: true,
            adjusted_by: activeOperatorEmail,
            reason: leaveLabel,
          });
        });
      });
    } else {
      const formattedInTime =
        checkInTime.length === 5 ? `${checkInTime}:00` : checkInTime;
      const formattedOutTime =
        checkOutTime.length === 5 ? `${checkOutTime}:00` : checkOutTime;

      sortedSelectedDates.forEach((targetDate) => {
        const dateObj = new Date(`${targetDate}T00:00:00`);
        const weekDayName = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
        });

        selectedEmployeeList.forEach((emp) => {
          const staffId = emp.staffCode || emp.id;

          batchRecords.push({
            id: staffId,
            staffCode: staffId,
            date: targetDate,
            weekday: weekDayName,
            time: formattedInTime,
            type: "IN",
            isManualOverride: true,
            adjusted_by: activeOperatorEmail,
            reason: `${auditReason.trim()} (Check-In)`,
          });

          batchRecords.push({
            id: staffId,
            staffCode: staffId,
            date: targetDate,
            weekday: weekDayName,
            time: formattedOutTime,
            type: "OUT",
            isManualOverride: true,
            adjusted_by: activeOperatorEmail,
            reason: `${auditReason.trim()} (Check-Out)`,
          });
        });
      });
    }

    const payload = {
      operatorEmail: activeOperatorEmail,
      records: batchRecords,
    };

    try {
      const response = await fetch("/api/attendance/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(
          resData.error || "Failed to post manual attendance records.",
        );
      }

      setNotification({
        type: "success",
        message:
          attendanceMode === "LEAVE"
            ? `${LEAVE_TYPES.find((lt) => lt.code === leaveType)?.label || leaveType} marked successfully for ${selectedEmployeeList.length} employee(s) across ${selectedDates.size} date(s).`
            : `Attendance logged successfully for ${selectedEmployeeList.length} employee(s) across ${selectedDates.size} date(s). Total entries: ${batchRecords.length / 2}`,
      });

      setShowPreviewModal(false);
      setSelectedEmployeeIds(new Set());
      setShowOnlySelected(false);
      onRefreshDashboard();
    } catch (err: any) {
      setNotification({
        type: "error",
        message:
          err.message || "An error occurred while submitting attendance.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Missing Section State
  const [missingSectionDate, setMissingSectionDate] =
    useState<string>(todayStr);
  const [showMissingSection, setShowMissingSection] = useState<boolean>(true);
  const [expandedOperatorKeys, setExpandedOperatorKeys] = useState<Set<string>>(
    new Set(),
  );

  type MissingEntry = {
    checkIn: string;
    checkOut: string;
    reason: string;
    submitting: boolean;
  };
  const [missingEntryState, setMissingEntryState] = useState<
    Record<string, MissingEntry>
  >({});

  const getPunchStatusForDate = (emp: Employee, dateStr: string) => {
    const empId = String(emp.staffCode || emp.id);
    const dateRecords =
      (attendanceRecords || []).filter((rec) => {
        const recDate = rec.date || rec.swipe_date;
        return recDate === dateStr;
      }) || [];
    const empRecords = dateRecords.filter((rec) => {
      const rEmpId = String(rec.staffCode || rec.employeeId || rec.id);
      return rEmpId === empId;
    });
    const hasIn = empRecords.some((r) => (r.type || r.swipe_type) === "IN");
    const hasOut = empRecords.some((r) => (r.type || r.swipe_type) === "OUT");
    return { hasIn, hasOut, isComplete: hasIn && hasOut };
  };

  const isMissingSectionFutureDate = missingSectionDate > todayStr;

  const operatorMissingGroups = useMemo(() => {
    if (!operatorScope?.isSuperuser || isMissingSectionFutureDate) return [];

    return (systemUsers || [])
      .filter((su) => !su.isSuperuser && (su.department || su.costCenter))
      .map((su) => {
        const opEmployees = activeEmployeeSource.filter((emp: any) => {
          const deptMatch = su.department
            ? emp.department === su.department
            : true;
          const ccMatch = su.costCenter
            ? emp.costCenter === su.costCenter
            : true;
          return deptMatch && ccMatch;
        });

        const missing = opEmployees.filter(
          (emp: any) => !getPunchStatusForDate(emp, missingSectionDate).isComplete,
        );

        return { operator: su, missing };
      })
      .filter((g) => g.missing.length > 0);
  }, [
    systemUsers,
    activeEmployeeSource,
    attendanceRecords,
    missingSectionDate,
    operatorScope,
    isMissingSectionFutureDate,
  ]);

  const ownMissingEmployees = useMemo(() => {
    if (
      !operatorScope ||
      operatorScope.isSuperuser ||
      isMissingSectionFutureDate
    )
      return [];
    return activeEmployeeSource.filter(
      (emp: any) => !getPunchStatusForDate(emp, missingSectionDate).isComplete,
    );
  }, [
    activeEmployeeSource,
    attendanceRecords,
    missingSectionDate,
    operatorScope,
    isMissingSectionFutureDate,
  ]);

  const toggleOperatorExpanded = (key: string) => {
    setExpandedOperatorKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getMissingEntry = (key: string): MissingEntry =>
    missingEntryState[key] || {
      checkIn: "",
      checkOut: "",
      reason: OVERRIDE_REASONS[0],
      submitting: false,
    };

  const updateMissingEntry = (
    key: string,
    field: "checkIn" | "checkOut" | "reason",
    value: string,
  ) => {
    setMissingEntryState((prev) => ({
      ...prev,
      [key]: { ...getMissingEntry(key), [field]: value },
    }));
  };

  const handleLogSingleEmployeeAttendance = async (
    emp: Employee,
    dateStr: string,
  ) => {
    const empId = String(emp.staffCode || emp.id);
    const key = `${empId}-${dateStr}`;
    const entry = getMissingEntry(key);

    if (!entry.checkIn && !entry.checkOut) {
      setNotification({
        type: "error",
        message: "Enter a check-in time, check-out time, or both.",
      });
      return;
    }
    if (!entry.reason.trim()) {
      setNotification({
        type: "error",
        message: "Please select a reason before logging attendance.",
      });
      return;
    }

    const { hasIn, hasOut } = getPunchStatusForDate(emp, dateStr);
    const dateObj = new Date(`${dateStr}T00:00:00`);
    const weekDayName = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const records: any[] = [];

    if (entry.checkIn && !hasIn) {
      const formattedInTime =
        entry.checkIn.length === 5 ? `${entry.checkIn}:00` : entry.checkIn;
      records.push({
        id: empId,
        staffCode: empId,
        date: dateStr,
        weekday: weekDayName,
        time: formattedInTime,
        type: "IN",
        isManualOverride: true,
        adjusted_by: activeOperatorEmail,
        reason: `${entry.reason.trim()} (Check-In)`,
      });
    }

    if (entry.checkOut && !hasOut) {
      const formattedOutTime =
        entry.checkOut.length === 5 ? `${entry.checkOut}:00` : entry.checkOut;
      records.push({
        id: empId,
        staffCode: empId,
        date: dateStr,
        weekday: weekDayName,
        time: formattedOutTime,
        type: "OUT",
        isManualOverride: true,
        adjusted_by: activeOperatorEmail,
        reason: `${entry.reason.trim()} (Check-Out)`,
      });
    }

    if (records.length === 0) {
      setNotification({
        type: "error",
        message:
          "The punch(es) you entered already exist for this employee on this date.",
      });
      return;
    }

    setMissingEntryState((prev) => ({
      ...prev,
      [key]: { ...entry, submitting: true },
    }));

    try {
      const response = await fetch("/api/attendance/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorEmail: activeOperatorEmail,
          records,
        }),
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(
          resData.error || "Failed to post manual attendance record.",
        );
      }

      setNotification({
        type: "success",
        message: `Logged ${records.length} punch(es) for ${
          emp.fullName || emp.name
        } on ${dateStr}.`,
      });

      setMissingEntryState((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      onRefreshDashboard();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "An error occurred while logging attendance.",
      });
      setMissingEntryState((prev) => ({
        ...prev,
        [key]: { ...entry, submitting: false },
      }));
    }
  };

  const renderMissingEmployeeRow = (emp: Employee, dateStr: string) => {
    const empId = String(emp.staffCode || emp.id);
    const key = `${empId}-${dateStr}`;
    const entry = getMissingEntry(key);
    const { hasIn, hasOut } = getPunchStatusForDate(emp, dateStr);

    return (
      <div
        key={key}
        className="p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors"
      >
        <div className="md:w-48 flex-shrink-0">
          <p className="text-sm font-semibold text-gray-800">
            {emp.fullName || emp.name}
          </p>
          <p className="text-[11px] text-gray-500">
            ID: {empId} • {emp.department || "N/A"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="time"
            value={entry.checkIn}
            disabled={hasIn || entry.submitting}
            onChange={(e) => updateMissingEntry(key, "checkIn", e.target.value)}
            title={hasIn ? "Check-in already recorded" : "Check-in time"}
            className="px-2 py-1 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed w-28"
          />
          {hasIn && (
            <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-semibold">
              IN OK
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="time"
            value={entry.checkOut}
            disabled={hasOut || entry.submitting}
            onChange={(e) =>
              updateMissingEntry(key, "checkOut", e.target.value)
            }
            title={hasOut ? "Check-out already recorded" : "Check-out time"}
            className="px-2 py-1 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed w-28"
          />
          {hasOut && (
            <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-semibold">
              OUT OK
            </span>
          )}
        </div>

        <select
          value={entry.reason}
          disabled={entry.submitting}
          onChange={(e) => updateMissingEntry(key, "reason", e.target.value)}
          className="flex-1 min-w-[160px] px-2 py-1 border rounded-md text-xs bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          {OVERRIDE_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <button
          onClick={() => handleLogSingleEmployeeAttendance(emp, dateStr)}
          disabled={entry.submitting || (hasIn && hasOut)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0"
        >
          {entry.submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserCheck className="w-3.5 h-3.5" />
          )}
          {entry.submitting ? "Logging..." : "Log"}
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen relative">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4 transition-shadow hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Daily Attendance Checklist
            </h2>
            <p className="text-sm text-gray-500">
              Batch manage daily workspace attendance for multiple employees
              across multiple dates
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isScopeLocked ? (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              {operatorScope?.department ? (
                <span className="font-medium text-gray-700">
                  {operatorScope.department}
                  {operatorScope.costCenter
                    ? ` • ${operatorScope.costCenter}`
                    : ""}
                </span>
              ) : (
                <span className="font-medium text-amber-600">
                  No department assigned — contact an admin
                </span>
              )}
            </div>
          ) : (
            <>
              <select
                value={selectedDept}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all hover:border-blue-300"
              >
                <option value="">All Departments</option>
                {Array.from(
                  new Set(
                    activeEmployeeSource
                      .map((e: any) => e.department)
                      .filter(Boolean),
                  ),
                ).map((dept: any) => (
                  <option key={dept} value={dept}>
                    {dept.toUpperCase()}
                  </option>
                ))}
              </select>

              <select
                value={selectedCostCenter}
                onChange={(e) => setSelectedCostCenter(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all hover:border-blue-300"
              >
                <option value="">All Cost Centers</option>
                {availableCostCenters.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>

              <select
                value={selectedSubCenter}
                onChange={(e) => setSelectedSubCenter(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all hover:border-blue-300"
              >
                <option value="">All Sub Centers</option>
                {availableSubcenters.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          key={notification.message}
          className={`p-4 rounded-md flex items-center gap-2 border animate-in fade-in slide-in-from-top-2 duration-300 ${notification.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Multi-Select Employee List */}
        <div className="lg:col-span-5 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[700px] transition-shadow hover:shadow-md">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold uppercase text-gray-500">
                Workspace Employees ({selectedEmployeeIds.size} Selected)
              </label>

              <div className="flex items-center gap-2">
                {selectedEmployeeIds.size > 0 && (
                  <button
                    onClick={handleClearAllSelections}
                    className="text-xs text-red-600 hover:underline font-medium transition-colors animate-in fade-in duration-200"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={toggleSelectAllFiltered}
                  disabled={searchMatchedEmployees.length === 0}
                  className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline transition-colors"
                >
                  {isAllFilteredSelected ? (
                    <CheckSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  {isAllFilteredSelected
                    ? "Deselect Filtered"
                    : `Select All Filtered (${searchMatchedEmployees.length})`}
                </button>
              </div>
            </div>

            {/* Filter Toggle Button */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => setShowOnlySelected(!showOnlySelected)}
                disabled={selectedEmployeeIds.size === 0 && !showOnlySelected}
                className={`w-full text-xs font-semibold py-1.5 px-3 rounded-md border flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                  showOnlySelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {showOnlySelected
                  ? "Show All Employees"
                  : `Show Selected Only (${selectedEmployeeIds.size})`}
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 transition-colors peer-focus:text-blue-500" />
              <input
                type="text"
                placeholder="Search by name or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="peer w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {displayedEmployees.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2 animate-in fade-in duration-300">
                <Users className="w-8 h-8 text-gray-300" />
                {showOnlySelected
                  ? "No checked employees found."
                  : "No employees found matching filter."}
              </div>
            ) : (
              displayedEmployees.map((employee: any, idx) => {
                const empId = String(employee.staffCode || employee.id);
                const empName = employee.fullName || employee.name;
                const isChecked = selectedEmployeeIds.has(empId);
                const empSubCenter = employee.subCenter || employee.subcenter;

                const conflictObj = employeesWithCompleteRecords.find(
                  (c) =>
                    String(c.employee.staffCode || c.employee.id) === empId,
                );

                return (
                  <div
                    key={empId}
                    onClick={() => toggleEmployeeSelection(empId)}
                    style={{ animationDelay: `${Math.min(idx, 20) * 20}ms` }}
                    className={`p-4 cursor-pointer transition-all duration-200 flex items-center justify-between hover:bg-gray-50 animate-in fade-in slide-in-from-left-1 ${
                      conflictObj
                        ? "bg-red-50/90 border-l-4 border-red-600"
                        : isChecked
                          ? "bg-blue-50/80 border-l-4 border-blue-600"
                          : "border-l-4 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer transition-transform checked:scale-110"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800 text-sm">
                            {empName}
                          </h4>
                          {conflictObj && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold animate-pulse">
                              Complete Record on {conflictObj.date}
                            </span>
                          )}
                          {isChecked && !conflictObj && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium animate-in fade-in zoom-in-95 duration-200">
                              Checked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          ID: {empId} • {employee.department || "N/A"}
                        </p>
                        {conflictObj ? (
                          <p className="text-[11px] text-red-700 font-medium mt-0.5 flex items-center gap-1">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            Confirmed By:{" "}
                            {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                              conflictObj.confirmedBy,
                            ) ? (
                              <a
                                href={`mailto:${conflictObj.confirmedBy}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold underline hover:text-red-900 transition-colors"
                              >
                                {conflictObj.confirmedBy}
                              </a>
                            ) : (
                              <strong>{conflictObj.confirmedBy}</strong>
                            )}
                          </p>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              CC: {employee.costCenter || "N/A"}
                            </span>
                            {empSubCenter && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-medium">
                                Sub: {empSubCenter}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Multi-Date Calendar Controls */}
        <div className="lg:col-span-7 bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-between h-[700px] overflow-y-auto transition-shadow hover:shadow-md">
          <div className="flex flex-col gap-5">
            {/* Multi-Selection Counter Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div>
                <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Batch Target Group
                </span>
                <h3 className="text-lg font-bold text-gray-800 transition-all">
                  {selectedEmployeeIds.size} Employee(s) Selected
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400 block">
                  Target Log Date(s)
                </span>
                <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">
                  {selectedDates.size} Date(s) Selected
                </span>
              </div>
            </div>

            {/* Existing Complete Record Warning Banner */}
            {hasConflictingRecords && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-red-900">
                      Cannot Proceed: Complete Record Already Exists (
                      {employeesWithCompleteRecords.length})
                    </h4>
                    <p className="text-xs text-red-700 mt-0.5">
                      The following employee(s) already have complete attendance
                      records on selected dates. Please remove them to proceed.
                    </p>
                  </div>
                </div>

                {/* Conflicting Employees List */}
                <div className="max-h-28 overflow-y-auto divide-y divide-red-200 border border-red-200 rounded bg-white text-xs">
                  {employeesWithCompleteRecords.map((c, idx) => {
                    const cId = String(c.employee.staffCode || c.employee.id);
                    return (
                      <div
                        key={`${cId}-${c.date}-${idx}`}
                        className="p-2 flex justify-between items-center text-red-900 transition-colors hover:bg-red-50/60"
                      >
                        <div>
                          <span className="font-semibold">
                            {c.employee.fullName || c.employee.name}
                          </span>
                          <span className="text-gray-500 ml-1">({cId})</span>
                          <span className="ml-2 font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded text-[10px]">
                            {c.date}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-gray-600 block">
                            Confirmed By:
                          </span>
                          {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.confirmedBy) ? (
                            <a
                              href={`mailto:${c.confirmedBy}`}
                              className="font-medium text-red-800 underline hover:text-red-900 transition-colors"
                            >
                              {c.confirmedBy}
                            </a>
                          ) : (
                            <span className="font-medium text-red-800">
                              {c.confirmedBy}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleRemoveConflictingEmployees}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 hover:shadow"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Remove Blocked Employees from Batch
                  </button>
                </div>
              </div>
            )}

            {/* Calendar Controls & Multi-Date Quick Actions */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  Select Attendance Date(s)
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-gray-100 rounded transition-all active:scale-90"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-medium text-gray-600 min-w-[110px] text-center">
                    {currentMonth.toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-gray-100 rounded transition-all active:scale-90"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Quick Multi-Date Selection Bar */}
              <div className="flex items-center justify-between gap-2 mb-3 bg-gray-50 p-2 rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectPastWorkdaysInMonth}
                    className="text-xs bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 font-medium px-2.5 py-1 rounded shadow-xs flex items-center gap-1 transition-all"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    Select Workdays (Mon-Fri)
                  </button>
                  <button
                    onClick={handleResetDatesToToday}
                    className="text-xs bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 font-medium px-2.5 py-1 rounded shadow-xs flex items-center gap-1 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Today
                  </button>
                </div>
                <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                  Click dates to toggle selection
                </span>
              </div>

              {/* Days Grid */}
              <div
                key={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`}
                className="grid grid-cols-7 gap-2 text-center animate-in fade-in duration-200"
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <span
                      key={day}
                      className="text-xs font-semibold text-gray-400 py-1"
                    >
                      {day}
                    </span>
                  ),
                )}

                {/* Empty Spacer Cells */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="py-2" />
                ))}

                {/* Actual Month Days */}
                {daysInMonth.map((day) => {
                  const formattedDate = formatLocalDate(day);
                  const isSelected = selectedDates.has(formattedDate);
                  const isToday = todayStr === formattedDate;
                  const isFutureDate = formattedDate > todayStr;
                  const holiday = holidaysByDate.get(formattedDate);
                  const isHoliday = !!holiday;

                  let dayStyle = "hover:bg-gray-100 text-gray-700";

                  if (isFutureDate) {
                    dayStyle =
                      "opacity-40 cursor-not-allowed bg-gray-50 text-gray-400";
                  } else if (isSelected) {
                    dayStyle =
                      "bg-blue-600 text-white font-bold shadow-sm ring-2 ring-blue-300 scale-105";
                  } else if (isToday) {
                    dayStyle =
                      "bg-blue-50 text-blue-600 border border-blue-200 font-semibold";
                  } else if (isHoliday) {
                    dayStyle =
                      "bg-purple-50 text-purple-700 border border-purple-200 font-semibold hover:bg-purple-100";
                  }

                  return (
                    <button
                      key={formattedDate}
                      disabled={isFutureDate}
                      onClick={() => toggleDateSelection(formattedDate)}
                      title={isHoliday ? holiday!.name : undefined}
                      className={`relative py-2 text-sm rounded-md transition-all duration-150 flex items-center justify-center ${!isFutureDate ? "hover:scale-105 active:scale-95" : ""} ${dayStyle}`}
                    >
                      <span>{day.getDate()}</span>
                      {isHoliday && (
                        <span
                          className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${
                            isSelected ? "bg-white" : "bg-purple-500"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Dates Badges Summary */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-500">
                  Selected Dates:
                </span>
                {sortedSelectedDates.map((d) => (
                  <span
                    key={d}
                    className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-200"
                  >
                    {d}
                    {selectedDates.size > 1 && (
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-600 transition-colors"
                        onClick={() => toggleDateSelection(d)}
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Entry Mode Toggle: Punch (IN/OUT) vs Leave (SK/AL) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <FileEdit className="w-3.5 h-3.5 text-blue-600" />
                Entry Type
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setAttendanceMode("PUNCH")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${
                    attendanceMode === "PUNCH"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> Log Attendance (IN/OUT)
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceMode("LEAVE")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${
                    attendanceMode === "LEAVE"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Mark Leave (SK / AL)
                </button>
              </div>
            </div>

            {attendanceMode === "PUNCH" ? (
              <>
                {/* Time Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> Check-In Time
                    </label>
                    <input
                      type="time"
                      disabled={
                        hasFutureDateSelected ||
                        selectedEmployeeIds.size === 0 ||
                        hasConflictingRecords
                      }
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> Check-Out Time
                    </label>
                    <input
                      type="time"
                      disabled={
                        hasFutureDateSelected ||
                        selectedEmployeeIds.size === 0 ||
                        hasConflictingRecords
                      }
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                    />
                  </div>
                </div>

                {/* Audit Reason Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <FileEdit className="w-3.5 h-3.5 text-blue-600" />
                    Reason / Change Reason{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    disabled={
                      hasFutureDateSelected ||
                      selectedEmployeeIds.size === 0 ||
                      hasConflictingRecords
                    }
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                  >
                    {OVERRIDE_REASONS.map((reasonOption) => (
                      <option key={reasonOption} value={reasonOption}>
                        {reasonOption}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Leave Type Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {LEAVE_TYPES.map((lt) => (
                      <button
                        key={lt.code}
                        type="button"
                        disabled={
                          hasFutureDateSelected ||
                          selectedEmployeeIds.size === 0
                        }
                        onClick={() => setLeaveType(lt.code)}
                        className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-md text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          leaveType === lt.code
                            ? "bg-blue-50 border-blue-300 text-blue-700"
                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-sm font-bold">{lt.code}</span>
                        <span>{lt.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 pt-0.5">
                    Marks each selected employee as{" "}
                    <span className="font-semibold">
                      {LEAVE_TYPES.find((lt) => lt.code === leaveType)?.label}
                    </span>{" "}
                    ({leaveType}) for every selected date — no check-in /
                    check-out punch is required. Change Reason will be saved
                    as &quot;{auditReason}&quot;.
                  </p>
                </div>
              </>
            )}

            {/* Modal Trigger */}
            <div className="pt-2">
              <button
                onClick={() => setShowPreviewModal(true)}
                disabled={
                  selectedEmployeeIds.size === 0 ||
                  selectedDates.size === 0 ||
                  hasFutureDateSelected ||
                  (attendanceMode === "PUNCH" && hasConflictingRecords)
                }
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-sm transition-all active:scale-[0.98] hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              >
                <UserCheck className="w-5 h-5" />
                {attendanceMode === "LEAVE"
                  ? `Preview & Confirm Leave (${selectedEmployeeIds.size} Employees × ${selectedDates.size} Days)`
                  : `Preview & Confirm Batch (${selectedEmployeeIds.size} Employees × ${selectedDates.size} Days)`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Operators Missing Attendance */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 transition-shadow hover:shadow-md">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <button
            onClick={() => setShowMissingSection(!showMissingSection)}
            className="flex items-center gap-2 text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">
                {operatorScope?.isSuperuser
                  ? "Operators Missing Attendance"
                  : "Your Missing Attendance"}
              </h3>
              <p className="text-xs text-gray-500">
                {operatorScope?.isSuperuser
                  ? "Employees without a complete check-in/out for the selected day, grouped by assigned operator"
                  : "Employees in your department/cost center without a complete check-in/out for the selected day"}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={missingSectionDate}
              max={todayStr}
              onChange={(e) => setMissingSectionDate(e.target.value)}
              className="px-2 py-1.5 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowMissingSection(!showMissingSection)}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-all"
            >
              {showMissingSection ? (
                <ChevronLeft className="w-4 h-4 text-gray-500 rotate-90" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500 rotate-90" />
              )}
            </button>
          </div>
        </div>

        {showMissingSection && (
          <div className="p-4">
            {isMissingSectionFutureDate ? (
              <div className="p-6 text-center text-sm text-gray-400">
                Attendance status isn't available for future dates.
              </div>
            ) : operatorScope === null ? (
              <div className="p-6 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading operator
                scope...
              </div>
            ) : operatorScope.isSuperuser ? (
              operatorMissingGroups.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                  <PartyPopper className="w-6 h-6 text-gray-300" />
                  Every assigned operator's employees are fully checked in and
                  out for {missingSectionDate}.
                </div>
              ) : (
                <div className="space-y-3">
                  {operatorMissingGroups.map(({ operator, missing }) => {
                    const opKey = String(operator.id || operator.email);
                    const isExpanded = expandedOperatorKeys.has(opKey);
                    return (
                      <div
                        key={opKey}
                        className="border border-gray-200 rounded-md overflow-hidden"
                      >
                        <button
                          onClick={() => toggleOperatorExpanded(opKey)}
                          className="w-full flex items-center justify-between gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <UserX className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {operator.email}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate">
                                {operator.department || "N/A"}
                                {operator.costCenter
                                  ? ` • ${operator.costCenter}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex-shrink-0">
                            {missing.length} missing
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="divide-y divide-gray-100">
                            {missing.map((emp) =>
                              renderMissingEmployeeRow(emp, missingSectionDate),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : !operatorScope.department ? (
              <div className="p-6 text-center text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md">
                No department or cost center is assigned to your account yet.
                Contact an administrator to be scoped to a workspace.
              </div>
            ) : ownMissingEmployees.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                <PartyPopper className="w-6 h-6 text-gray-300" />
                All of your employees are fully checked in and out for{" "}
                {missingSectionDate}.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                {ownMissingEmployees.map((emp) =>
                  renderMissingEmployeeRow(emp, missingSectionDate),
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-250 ease-out">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                {attendanceMode === "LEAVE"
                  ? "Confirm Multi-Date Leave Preview"
                  : "Confirm Multi-Date Batch Preview"}
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-all hover:rotate-90 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-xs text-gray-700 space-y-1">
              <p>
                <strong>Target Dates ({selectedDates.size}):</strong>{" "}
                {sortedSelectedDates.join(", ")}
              </p>
              {attendanceMode === "LEAVE" ? (
                <p>
                  <strong>Leave Type:</strong>{" "}
                  {LEAVE_TYPES.find((lt) => lt.code === leaveType)?.label} (
                  {leaveType})
                </p>
              ) : (
                <>
                  <p>
                    <strong>Check-In Time:</strong> {checkInTime}
                  </p>
                  <p>
                    <strong>Check-Out Time:</strong> {checkOutTime}
                  </p>
                </>
              )}
              <p>
                <strong>Change Reason:</strong> {auditReason}
              </p>
              <p>
                <strong>Adjusted By Operator:</strong> {activeOperatorEmail}
              </p>
              <p className="font-bold text-blue-700 pt-1">
                {attendanceMode === "LEAVE"
                  ? `Total Leave Records to Create: ${selectedEmployeeList.length * selectedDates.size} records`
                  : `Total Attendance Swipes to Create: ${selectedEmployeeList.length * selectedDates.size * 2} records`}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
                Target Employees ({selectedEmployeeList.length})
              </label>
              <div className="max-h-40 overflow-y-auto divide-y border rounded-md divide-gray-100 bg-white">
                {selectedEmployeeList.map((emp) => (
                  <div
                    key={emp.staffCode || emp.id}
                    className="p-2.5 flex justify-between items-center text-xs transition-colors hover:bg-gray-50"
                  >
                    <div>
                      <span className="font-semibold text-gray-800">
                        {emp.fullName || emp.name}
                      </span>
                      <span className="text-gray-400 ml-2">
                        ({emp.staffCode || emp.id})
                      </span>
                    </div>
                    <span className="text-gray-500">
                      {emp.department || "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <button
                onClick={() => setShowPreviewModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchConfirmAttendance}
                disabled={
                  isSubmitting ||
                  (attendanceMode === "PUNCH" && hasConflictingRecords)
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 hover:shadow-md"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? "Posting Records..."
                  : attendanceMode === "LEAVE"
                    ? "Confirm & Submit Leave"
                    : "Confirm & Submit Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyChecklist;