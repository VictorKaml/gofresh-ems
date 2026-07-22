"use client";

import React, { useState, useMemo } from "react";
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

interface Props {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  departments: string[];
  costCenters: string[];
  operatorEmail?: string;
  onRefreshDashboard: () => void;
  onDownloadExceptionReport?: (group: string) => void;
  onDownloadOverallAnalytics?: (dept: string, costCenter: string) => void;
}

const OVERRIDE_REASONS = [
  "Biometric / Card Reader Failure",
  "Approved Field Duty / Onsite Work",
  "System Outage / Offline Portal",
  "Manual Attendance Form Approved",
  "Badge Forgotten / Misplaced",
  "Official Travel / Duty Out of Station",
  "Management Override / Special Approval",
];

const DailyChecklist: React.FC<Props> = ({
  employees,
  attendanceRecords,
  departments,
  costCenters,
  operatorEmail,
  onRefreshDashboard,
  onDownloadExceptionReport,
  onDownloadOverallAnalytics,
}) => {
  // Local ISO date formatter helper (YYYY-MM-DD)
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filter States
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);

  // Multi-Employee Selection Set
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    new Set(),
  );

  // Modal State for Previewing
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Available Cost Centers based on selected department
  const availableCostCenters = useMemo(() => {
    if (!selectedDept) return costCenters || [];
    const filteredCCs =
      employees
        ?.filter((emp) => emp.department === selectedDept && emp.costCenter)
        .map((emp) => emp.costCenter as string) || [];
    return Array.from(new Set(filteredCCs));
  }, [selectedDept, employees, costCenters]);

  // ADD THIS BACK IN:
  const handleDepartmentChange = (dept: string) => {
    setSelectedDept(dept);
    setSelectedCostCenter("");
  };

  // Calendar & Punch Form States
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [checkInTime, setCheckInTime] = useState<string>("07:30");
  const [checkOutTime, setCheckOutTime] = useState<string>("16:30");
  const [auditReason, setAuditReason] = useState<string>(OVERRIDE_REASONS[0]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isSelectedDateInFuture = useMemo(() => {
    return selectedDate > todayStr;
  }, [selectedDate, todayStr]);

  // Base Match Function for Search and Dept/CostCenter filters
  const matchesFilter = (emp: Employee) => {
    const matchesDept = !selectedDept || emp.department === selectedDept;
    const matchesCC =
      !selectedCostCenter || emp.costCenter === selectedCostCenter;
    const name = (emp.fullName || emp.name || "").toString();
    const id = (emp.staffCode || emp.id || "").toString();
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesCC && matchesSearch;
  };

  // List of employees matching search criteria
  const searchMatchedEmployees = useMemo(() => {
    return employees?.filter(matchesFilter) || [];
  }, [employees, selectedDept, selectedCostCenter, searchQuery]);

  // Displayed Employees List
  const displayedEmployees = useMemo(() => {
    return (
      employees?.filter((emp) => {
        const empId = String(emp.staffCode || emp.id);
        const isChecked = selectedEmployeeIds.has(empId);

        if (showOnlySelected) {
          return isChecked && matchesFilter(emp);
        }

        return matchesFilter(emp);
      }) || []
    );
  }, [
    employees,
    selectedEmployeeIds,
    showOnlySelected,
    selectedDept,
    selectedCostCenter,
    searchQuery,
  ]);

  // Selected Employee Objects Array
  const selectedEmployeeList = useMemo(() => {
    return (
      employees?.filter((emp) => {
        const id = String(emp.staffCode || emp.id);
        return selectedEmployeeIds.has(id);
      }) || []
    );
  }, [employees, selectedEmployeeIds]);

  // Check existing attendance for selected employees on selected target date
  const employeesWithCompleteRecords = useMemo(() => {
    if (!selectedDate || selectedEmployeeIds.size === 0) return [];

    // Added optional chaining (?.) and fallback array (|| [])
    const dateRecords =
      attendanceRecords?.filter((rec) => {
        const recDate = rec.date || rec.swipe_date;
        return recDate === selectedDate;
      }) || [];

    const conflicts: Array<{ employee: Employee; confirmedBy: string }> = [];

    // Added optional chaining (?.) before forEach
    selectedEmployeeList?.forEach((emp) => {
      const empId = String(emp.staffCode || emp.id);

      const empRecords = dateRecords.filter((rec) => {
        const rEmpId = String(rec.staffCode || rec.employeeId || rec.id);
        return rEmpId === empId;
      });

      const hasIn = empRecords.some((r) => (r.type || r.swipe_type) === "IN");
      const hasOut = empRecords.some((r) => (r.type || r.swipe_type) === "OUT");

      // Complete record has both IN and OUT
      if (hasIn && hasOut) {
        // Retrieve who confirmed/adjusted the record
        const recordWithOperator = empRecords.find(
          (r) =>
            r.adjusted_by ||
            r.adjustedBy ||
            r.operatorEmail ||
            r.operator_email ||
            r.created_by ||
            r.updated_by,
        );

        const confirmedBy =
          recordWithOperator?.adjusted_by ||
          recordWithOperator?.adjustedBy ||
          recordWithOperator?.operatorEmail ||
          recordWithOperator?.operator_email ||
          recordWithOperator?.created_by ||
          recordWithOperator?.updated_by ||
          "System / Biometric Reader";

        conflicts.push({
          employee: emp,
          confirmedBy,
        });
      }
    });

    return conflicts;
  }, [
    selectedDate,
    selectedEmployeeList,
    attendanceRecords,
    selectedEmployeeIds,
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

    // First day of the target month
    const firstDay = new Date(year, month, 1);
    const dayOfWeekIndex = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

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

  // Batch Submit Punch Logic
  const handleBatchConfirmAttendance = async () => {
    if (
      selectedEmployeeList.length === 0 ||
      !selectedDate ||
      hasConflictingRecords
    )
      return;

    if (isSelectedDateInFuture) {
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

    const dateObj = new Date(`${selectedDate}T00:00:00`);
    const weekDayName = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
    });
    const formattedInTime =
      checkInTime.length === 5 ? `${checkInTime}:00` : checkInTime;
    const formattedOutTime =
      checkOutTime.length === 5 ? `${checkOutTime}:00` : checkOutTime;
    const activeOperator = operatorEmail || "OPERATOR_CHECKLIST_OVERRIDE";

    const batchRecords: any[] = [];
    selectedEmployeeList.forEach((emp) => {
      const staffId = emp.staffCode || emp.id;

      batchRecords.push({
        id: staffId,
        staffCode: staffId,
        date: selectedDate,
        weekday: weekDayName,
        time: formattedInTime,
        type: "IN",
        isManualOverride: true,
        adjusted_by: activeOperator,
        reason: `${auditReason.trim()} (Check-In)`,
      });

      batchRecords.push({
        id: staffId,
        staffCode: staffId,
        date: selectedDate,
        weekday: weekDayName,
        time: formattedOutTime,
        type: "OUT",
        isManualOverride: true,
        adjusted_by: activeOperator,
        reason: `${auditReason.trim()} (Check-Out)`,
      });
    });

    const payload = {
      operatorEmail: activeOperator,
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
        message: `Attendance logged successfully for ${selectedEmployeeList.length} employee(s) on ${selectedDate}.`,
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

  return (
    <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen relative">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Daily Attendance Checklist
          </h2>
          <p className="text-sm text-gray-500">
            Batch manage daily workspace attendance for multiple employees
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedDept}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Departments</option>
            {/* Add ?. right here */}
            {departments?.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={selectedCostCenter}
            onChange={(e) => setSelectedCostCenter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Cost Centers</option>
            {availableCostCenters.map((cc) => (
              <option key={cc} value={cc}>
                {cc}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              onDownloadExceptionReport &&
              onDownloadExceptionReport("Late Arrivals")
            }
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-sm font-medium border border-amber-200"
          >
            <FileText className="w-4 h-4" /> Exceptions
          </button>

          <button
            onClick={() =>
              onDownloadOverallAnalytics &&
              onDownloadOverallAnalytics(selectedDept, selectedCostCenter)
            }
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-medium border border-blue-200"
          >
            <BarChart3 className="w-4 h-4" /> Analytics PDF
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-md flex items-center gap-2 ${notification.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}
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
        <div className="lg:col-span-5 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[700px]">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold uppercase text-gray-500">
                Workspace Employees ({selectedEmployeeIds.size} Selected)
              </label>

              <div className="flex items-center gap-2">
                {selectedEmployeeIds.size > 0 && (
                  <button
                    onClick={handleClearAllSelections}
                    className="text-xs text-red-600 hover:underline font-medium"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={toggleSelectAllFiltered}
                  disabled={searchMatchedEmployees.length === 0}
                  className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
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

            {/* Filter Toggle Button to Strictly Show Selected Only */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => setShowOnlySelected(!showOnlySelected)}
                disabled={selectedEmployeeIds.size === 0 && !showOnlySelected}
                className={`w-full text-xs font-semibold py-1.5 px-3 rounded-md border flex items-center justify-center gap-1.5 transition-all ${
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
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {displayedEmployees.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                {showOnlySelected
                  ? "No checked employees found."
                  : "No employees found matching filter."}
              </div>
            ) : (
              displayedEmployees.map((employee) => {
                const empId = String(employee.staffCode || employee.id);
                const empName = employee.fullName || employee.name;
                const isChecked = selectedEmployeeIds.has(empId);

                // Check if employee has duplicate record
                const conflictObj = employeesWithCompleteRecords.find(
                  (c) =>
                    String(c.employee.staffCode || c.employee.id) === empId,
                );

                return (
                  <div
                    key={empId}
                    onClick={() => toggleEmployeeSelection(empId)}
                    className={`p-4 cursor-pointer transition-colors flex items-center justify-between hover:bg-gray-50 ${
                      conflictObj
                        ? "bg-red-50/90 border-l-4 border-red-600"
                        : isChecked
                          ? "bg-blue-50/80 border-l-4 border-blue-600"
                          : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800 text-sm">
                            {empName}
                          </h4>
                          {conflictObj && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                              Complete Record Exists
                            </span>
                          )}
                          {isChecked && !conflictObj && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                              Checked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          ID: {empId} • {employee.department || "N/A"}
                        </p>
                        {conflictObj ? (
                          <p className="text-[11px] text-red-700 font-medium mt-0.5">
                            Confirmed By:{" "}
                            <strong>{conflictObj.confirmedBy}</strong>
                          </p>
                        ) : (
                          <span className="inline-block mt-1 text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            CC: {employee.costCenter || "N/A"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Calendar & Target Log Date Controls */}
        <div className="lg:col-span-7 bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-between h-[700px] overflow-y-auto">
          <div className="flex flex-col gap-5">
            {/* Multi-Selection Counter Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div>
                <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Batch Target Group
                </span>
                <h3 className="text-lg font-bold text-gray-800">
                  {selectedEmployeeIds.size} Employee(s) Selected
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400 block">
                  Target Log Date
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {selectedDate}
                </span>
              </div>
            </div>

            {/* Existing Complete Record Warning Banner */}
            {hasConflictingRecords && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-red-900">
                      Cannot Proceed: Complete Record Already Exists (
                      {employeesWithCompleteRecords.length})
                    </h4>
                    <p className="text-xs text-red-700 mt-0.5">
                      The following employee(s) already have a complete IN/OUT
                      attendance record on <strong>{selectedDate}</strong> and
                      cannot be updated again in this batch. Please remove them
                      from the selection list to proceed.
                    </p>
                  </div>
                </div>

                {/* Conflicting Employees Table / List */}
                <div className="max-h-28 overflow-y-auto divide-y divide-red-200 border border-red-200 rounded bg-white text-xs">
                  {employeesWithCompleteRecords.map((c) => {
                    const cId = String(c.employee.staffCode || c.employee.id);
                    return (
                      <div
                        key={cId}
                        className="p-2 flex justify-between items-center text-red-900"
                      >
                        <div>
                          <span className="font-semibold">
                            {c.employee.fullName || c.employee.name}
                          </span>
                          <span className="text-gray-500 ml-1">({cId})</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-gray-600 block">
                            Confirmed By:
                          </span>
                          <span className="font-medium text-red-800">
                            {c.confirmedBy}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleRemoveConflictingEmployees}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Remove Blocked Employees from Batch
                  </button>
                </div>
              </div>
            )}

            {/* Calendar Controls */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  Select Attendance Date
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-medium text-gray-600">
                    {currentMonth.toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Days Grid */}
              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2 text-center">
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

                {/* Render Empty Spacer Cells for Offset Before Day 1 */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="py-2" />
                ))}

                {/* Render Actual Month Days */}
                {daysInMonth.map((day) => {
                  const formattedDate = formatLocalDate(day);
                  const isSelected = selectedDate === formattedDate;
                  const isToday = todayStr === formattedDate;
                  const isFutureDate = formattedDate > todayStr;

                  let dayStyle = "hover:bg-gray-100 text-gray-700";

                  if (isFutureDate) {
                    dayStyle =
                      "opacity-40 cursor-not-allowed bg-gray-50 text-gray-400";
                  } else if (isSelected) {
                    dayStyle =
                      "bg-blue-600 text-white shadow-sm ring-2 ring-blue-300";
                  } else if (isToday) {
                    dayStyle =
                      "bg-blue-50 text-blue-600 border border-blue-200 font-semibold";
                  }

                  return (
                    <button
                      key={formattedDate}
                      disabled={isFutureDate}
                      onClick={() => setSelectedDate(formattedDate)}
                      className={`py-2 text-sm rounded-md transition-all flex items-center justify-center ${dayStyle}`}
                    >
                      <span>{day.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Future Date Alert */}
            {isSelectedDateInFuture && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Attendance cannot be logged for future dates ({selectedDate}).
                  Please select today or a past date.
                </span>
              </div>
            )}

            {/* Time Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> Check-In Time
                </label>
                <input
                  type="time"
                  disabled={
                    isSelectedDateInFuture ||
                    selectedEmployeeIds.size === 0 ||
                    hasConflictingRecords
                  }
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> Check-Out Time
                </label>
                <input
                  type="time"
                  disabled={
                    isSelectedDateInFuture ||
                    selectedEmployeeIds.size === 0 ||
                    hasConflictingRecords
                  }
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Audit Reason Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <FileEdit className="w-3.5 h-3.5 text-blue-600" />
                Reason / Change Reason <span className="text-red-500">*</span>
              </label>
              <select
                disabled={
                  isSelectedDateInFuture ||
                  selectedEmployeeIds.size === 0 ||
                  hasConflictingRecords
                }
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {OVERRIDE_REASONS.map((reasonOption) => (
                  <option key={reasonOption} value={reasonOption}>
                    {reasonOption}
                  </option>
                ))}
              </select>
            </div>

            {/* Modal Trigger */}
            <div className="pt-2">
              <button
                onClick={() => setShowPreviewModal(true)}
                disabled={
                  selectedEmployeeIds.size === 0 ||
                  isSelectedDateInFuture ||
                  hasConflictingRecords
                }
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserCheck className="w-5 h-5" />
                Preview & Confirm Batch ({selectedEmployeeIds.size} Selected)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Confirm Attendance Preview
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-xs text-gray-700 space-y-1">
              <p>
                <strong>Target Date:</strong> {selectedDate}
              </p>
              <p>
                <strong>Check-In Time:</strong> {checkInTime}
              </p>
              <p>
                <strong>Check-Out Time:</strong> {checkOutTime}
              </p>
              <p>
                <strong>Override Reason:</strong> {auditReason}
              </p>
              <p>
                <strong>Adjusted By Operator:</strong>{" "}
                {operatorEmail || "System Admin"}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
                Target Employees ({selectedEmployeeList.length})
              </label>
              <div className="max-h-48 overflow-y-auto divide-y border rounded-md divide-gray-100 bg-white">
                {selectedEmployeeList.map((emp) => (
                  <div
                    key={emp.staffCode || emp.id}
                    className="p-2.5 flex justify-between items-center text-xs"
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
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchConfirmAttendance}
                disabled={isSubmitting || hasConflictingRecords}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting
                  ? "Posting Records..."
                  : "Confirm & Submit Attendance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyChecklist;
