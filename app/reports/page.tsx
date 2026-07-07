"use client";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  Building2, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users,
  MapPin
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EmployeeProfile {
  staffCode: string;
  fullName: string;
  department: string;
  costCenter: string;
  subCenter: string;
}

interface RawSwipe {
  id: string;
  date: string;
  time: string;
  type: string;
}

type ComplianceFilterMode = "ALL" | "ON_TIME" | "ABSENT" | "LATE" | "ONSITE";

export default function EMSTimesheetDashboard() {
  const departmentStructure: Record<string, string[]> = {
    "Go Fresh Chicken": [
      "Chicken Abattoir",
      "Chicken Portioning",
      "Chicken Deboning",
      "Chicken Value Add",
      "Blantyre Sales",
      "Lilongwe Sales",
      "Mzuzu Sales",
      "Zomba Sales",
    ],
    "Go Fresh Beef": [
      "Lilongwe LCS",
      "Lilongwe Sales",
      "Ngabu General",
      "Blantyre Cold Storage",
      "Cattle Ranching",
    ],
    "Tray Factory": ["GF Tray Factory"],
    "Live Sales": ["Blantyre Production", "Lilongwe Production"],
    Retail: [
      "HQ Management",
      "Finance and Accounts",
      "Human Resources",
    ],
  };

  const departmentsList = Object.keys(departmentStructure);
  const [selectedDept, setSelectedDept] = useState<string>("Go Fresh Chicken");

  const activeCostCenters = useMemo(() => {
    return departmentStructure[selectedDept] || [];
  }, [selectedDept]);

  const [selectedCC, setSelectedCC] = useState<string>("Chicken Abattoir");

  useEffect(() => {
    if (activeCostCenters.length > 0 && !activeCostCenters.includes(selectedCC)) {
      setSelectedCC(activeCostCenters[0]);
    }
  }, [activeCostCenters, selectedCC]);

  const [selectedSubCenter, setSelectedSubCenter] = useState<string>("Fillet");

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );

  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilterMode>("ALL");

  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([]);
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const weekDatesArray = useMemo(() => {
    const dates = [];
    const baseDate = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [startDate]);

  useEffect(() => {
    async function fetchEmployees() {
      setIsLoadingEmployees(true);
      try {
        const res = await fetch("/api/employees");
        if (res.ok) {
          const data = await res.json();
          setEmployeeDirectory(Array.isArray(data) ? data : data.employees || []);
        }
      } catch (err) {
        console.error("Failed fetching employee directory", err);
      } finally {
        setIsLoadingEmployees(false);
      }
    }
    fetchEmployees();
  }, []);

  useEffect(() => {
    async function fetchAttendance() {
      setIsLoadingAttendance(true);
      try {
        const url = `/api/attendance?startDate=${startDate}&endDate=${endDate}&size=50000`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setRawSwipesBuffer(data.swipes || []);
        }
      } catch (err) {
        console.error("Failed fetching attendance logs", err);
      } finally {
        setIsLoadingAttendance(false);
      }
    }
    fetchAttendance();
  }, [startDate, endDate]);

  const fullyCalculatedDataset = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    return employeeDirectory
      .filter(
        (emp) =>
          emp.department === selectedDept &&
          emp.costCenter === selectedCC &&
          emp.subCenter === selectedSubCenter,
      )
      .map((emp) => {
        let cumulativeRegular = 0;
        let cumulativeOvertime = 0;
        
        // Flags tracking the employee status within this timeline window
        let totalActiveDaysWithHours = 0;
        let employeeIsLateAtLeastOnce = false;
        let employeeIsOnTimeAtLeastOnce = false;
        let isOnsiteNow = false;

        const dailyBreakdown = weekDatesArray.map((dateStr) => {
          const daySwipes = rawSwipesBuffer.filter((s) => {
            const matchId = String(s.id).trim().toLowerCase() === String(emp.staffCode).trim().toLowerCase();
            const matchDate = String(s.date).trim() === String(dateStr).trim();
            return matchId && matchDate;
          });

          if (daySwipes.length === 0) {
            const checkDate = new Date(dateStr);
            const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6; 
            const isFuture = dateStr > todayStr;
            return { label: "0.0 / 0.0", isAbsent: !isWeekend && !isFuture, isLate: false, isOnTime: false };
          }

          const ins = daySwipes
            .filter((s) => {
              const t = String(s.type).toUpperCase();
              return t === "CHECK IN" || t === "IN";
            })
            .sort((a, b) => String(a.time).localeCompare(String(b.time)));

          const outs = daySwipes
            .filter((s) => {
              const t = String(s.type).toUpperCase();
              return t === "CHECK OUT" || t === "OUT";
            })
            .sort((a, b) => String(a.time).localeCompare(String(b.time)));

          // Onsite calculation logic: Checked in today but no check out out yet
          if (dateStr === todayStr && ins.length > 0 && outs.length === 0) {
            isOnsiteNow = true;
          }

          if (ins.length === 0 || outs.length === 0) {
            const checkDate = new Date(dateStr);
            const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;
            return { label: "0.0 / 0.0", isAbsent: !isWeekend && dateStr <= todayStr, isLate: false, isOnTime: false };
          }

          const firstInTime = ins[0].time;
          const lastOutTime = outs[outs.length - 1].time;

          const [inH, inM] = firstInTime.split(":").map(Number);
          const [outH, outM] = lastOutTime.split(":").map(Number);

          if (isNaN(inH) || isNaN(outH)) {
            return { label: "0.0 / 0.0", isAbsent: true, isLate: false, isOnTime: false };
          }

          const totalHours = (outH * 60 + outM - (inH * 60 + inM)) / 60;

          if (totalHours <= 0) {
            return { label: "0.0 / 0.0", isAbsent: true, isLate: false, isOnTime: false };
          }

          const standardCap = 8.5;
          let worked = totalHours > standardCap ? standardCap : totalHours;
          let ot = totalHours > standardCap ? totalHours - standardCap : 0;

          cumulativeRegular += worked;
          cumulativeOvertime += ot;
          totalActiveDaysWithHours++;

          const isLateShift = (inH > 8 || (inH === 8 && inM > 0));
          if (isLateShift) {
            employeeIsLateAtLeastOnce = true;
          } else {
            employeeIsOnTimeAtLeastOnce = true;
          }

          return {
            label: `${worked.toFixed(1)} / ${ot.toFixed(1)}`,
            isAbsent: false,
            isLate: isLateShift,
            isOnTime: !isLateShift
          };
        });

        // Clear distinction: Employee is absent if they have zero hours registered over the whole date range view
        const isCompletelyAbsentInPeriod = totalActiveDaysWithHours === 0;

        return {
          ...emp,
          dailyBreakdown,
          isCompletelyAbsentInPeriod,
          employeeIsLateAtLeastOnce,
          employeeIsOnTimeAtLeastOnce,
          isOnsiteNow,
          grandTotalLabel: `${cumulativeRegular.toFixed(1)} / ${cumulativeOvertime.toFixed(1)}`,
        };
      });
  }, [
    employeeDirectory,
    rawSwipesBuffer,
    weekDatesArray,
    selectedDept,
    selectedCC,
    selectedSubCenter,
  ]);

  // --- MATURED UNIQUE DIRECTORY AGGREGATES COMPILER ---
  const aggregateMetrics = useMemo(() => {
    let totalWorkforce = fullyCalculatedDataset.length;
    let onsiteTotal = 0;
    let onTimeTotal = 0;
    let absentTotal = 0;
    let lateTotal = 0;

    fullyCalculatedDataset.forEach(row => {
      if (row.isOnsiteNow) {
        onsiteTotal++;
      } else if (row.isCompletelyAbsentInPeriod) {
        absentTotal++;
      } else if (row.employeeIsLateAtLeastOnce) {
        lateTotal++;
      } else if (row.employeeIsOnTimeAtLeastOnce) {
        onTimeTotal++;
      }
    });

    return { totalWorkforce, onTimeTotal, absentTotal, lateTotal, onsiteTotal };
  }, [fullyCalculatedDataset]);

  // --- FILTER ROW INTERCEPT ROUTER ---
  const processedTimesheetData = useMemo(() => {
    return fullyCalculatedDataset.filter(row => {
      if (complianceFilter === "ONSITE") return row.isOnsiteNow;
      if (complianceFilter === "ABSENT") return row.isCompletelyAbsentInPeriod;
      if (complianceFilter === "LATE") return row.employeeIsLateAtLeastOnce && !row.isOnsiteNow;
      if (complianceFilter === "ON_TIME") return row.employeeIsOnTimeAtLeastOnce && !row.employeeIsLateAtLeastOnce && !row.isOnsiteNow;
      return true;
    });
  }, [fullyCalculatedDataset, complianceFilter]);

  const isDataSyncing = isLoadingEmployees || isLoadingAttendance;

  const handleDownloadReport = async () => {
    if (!processedTimesheetData || processedTimesheetData.length === 0) return;
    setIsDownloadingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.text("GoFresh", 12, 22);
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const tableHeaders = ["Staff Code", "Full Name"];
      weekDatesArray.forEach((dateStr) => {
        const d = new Date(dateStr);
        tableHeaders.push(`${weekdays[d.getDay()]} ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}`);
      });
      tableHeaders.push("Total (Reg/OT)");
      const tableBody = processedTimesheetData.map((row) => {
        const dataCells = [row.staffCode.toUpperCase(), row.fullName.toUpperCase()];
        row.dailyBreakdown.forEach((day) => dataCells.push(day.label));
        dataCells.push(row.grandTotalLabel);
        return dataCells;
      });
      autoTable(doc, { startY: 38, head: [tableHeaders], body: tableBody });
      doc.save(`GoFresh_Timesheet_${selectedDept.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen p-6 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* --- DYNAMIC CASCADE FILTER SECTION --- */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="p-4 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-green-700" /> GoFresh Department Cascade
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">1. Active Department</label>
              <div className="border rounded-lg divide-y divide-slate-100 overflow-hidden shadow-xs">
                {departmentsList.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`w-full text-left px-3 py-2.5 text-xs font-bold uppercase transition-colors ${
                      selectedDept === dept ? "bg-green-700 text-white" : "bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">2. Filter By Cost Center</label>
              <select
                value={selectedCC}
                onChange={(e) => setSelectedCC(e.target.value)}
                className="w-full bg-white border h-10 text-xs font-bold rounded-lg px-3 uppercase text-slate-800 focus:outline-green-700 shadow-xs"
              >
                {activeCostCenters.map((cc) => (
                  <option key={cc} value={cc}>{cc}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">3. Sub Center</label>
              <select
                value={selectedSubCenter}
                onChange={(e) => setSelectedSubCenter(e.target.value)}
                className="w-full bg-white border h-10 text-xs font-bold rounded-lg px-3 uppercase text-slate-800 focus:outline-green-700 shadow-xs"
              >
                <option value="Fillet">Fillet</option>
                <option value="Evaluation">Evaluation</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* --- RE-CALIBRATED INTERACTIVE COMPLIANCE METRICS ROW --- */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 w-full">
          <button
            onClick={() => setComplianceFilter("ALL")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ALL" ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Workforce</p>
              <p className="text-xl font-extrabold mt-0.5">{aggregateMetrics.totalWorkforce}</p>
            </div>
            <Users className={`w-5 h-5 ${complianceFilter === "ALL" ? "text-green-400" : "text-slate-400"}`} />
          </button>

          <button
            onClick={() => setComplianceFilter("ONSITE")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ONSITE" ? "bg-blue-900 border-blue-800 text-blue-50" : "bg-white border-slate-200 hover:bg-blue-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Onsite Now</p>
              <p className="text-xl font-extrabold text-blue-600 mt-0.5">{aggregateMetrics.onsiteTotal}</p>
            </div>
            <MapPin className="w-5 h-5 text-blue-500" />
          </button>

          <button
            onClick={() => setComplianceFilter("ON_TIME")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ON_TIME" ? "bg-emerald-900 border-emerald-800 text-emerald-50" : "bg-white border-slate-200 hover:bg-emerald-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">On Time</p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{aggregateMetrics.onTimeTotal}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </button>

          <button
            onClick={() => setComplianceFilter("ABSENT")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ABSENT" ? "bg-rose-900 border-rose-800 text-rose-50" : "bg-white border-slate-200 hover:bg-rose-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Absent In Period</p>
              <p className="text-xl font-extrabold text-rose-600 mt-0.5">{aggregateMetrics.absentTotal}</p>
            </div>
            <XCircle className="w-5 h-5 text-rose-500" />
          </button>

          <button
            onClick={() => setComplianceFilter("LATE")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "LATE" ? "bg-amber-900 border-amber-800 text-amber-50" : "bg-white border-slate-200 hover:bg-amber-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Late Arrivals</p>
              <p className="text-xl font-extrabold text-amber-600 mt-0.5">{aggregateMetrics.lateTotal}</p>
            </div>
            <Clock className="w-5 h-5 text-amber-500" />
          </button>
        </div>

        {/* --- MAIN ROSTER DATA SUMMARY --- */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="p-4 bg-slate-50/50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-2 flex-wrap">
              <span>Overview:</span> 
              <span className="text-green-700">{selectedDept}</span> &rarr;{" "}
              <span className="text-green-700">{selectedCC}</span>
              {complianceFilter !== "ALL" && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black border border-blue-200 uppercase">
                  Active Filter: {complianceFilter.replace("_", " ")}
                </span>
              )}
              {isDataSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-white p-2 border rounded-xl shadow-xs">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase px-1">From:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs font-mono font-bold border-none bg-transparent p-1 focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase px-1">To:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs font-mono font-bold border-none bg-transparent p-1 focus-visible:ring-0"
                />
              </div>
              <Button
                size="sm"
                onClick={handleDownloadReport}
                disabled={isDownloadingPdf || processedTimesheetData.length === 0}
                className="h-8 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
              >
                {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isDownloadingPdf ? "Compiling PDF..." : "Download Report"}</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {processedTimesheetData.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/30">
                {isDataSyncing ? "Syncing database data shards..." : "No workers match the chosen compliance status selection criteria."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 border-b text-slate-400 text-[10px] font-black uppercase tracking-wider">
                    <TableRow>
                      <TableHead className="w-[100px] p-3">Staff Code</TableHead>
                      <TableHead className="w-[160px] p-3">Full Name</TableHead>
                      {weekDatesArray.map((dateStr) => {
                        const d = new Date(dateStr);
                        return (
                          <TableHead key={dateStr} className="text-center p-3 font-bold">
                            {d.toLocaleDateString("en-US", { weekday: "short" })} {d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                          </TableHead>
                        );
                      })}
                      <TableHead className="text-center p-3 font-extrabold bg-emerald-50 text-emerald-900 border-l">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedTimesheetData.map((row) => (
                      <TableRow key={row.staffCode} className="hover:bg-slate-50/50">
                        <TableCell className="p-3 font-mono font-bold text-xs text-slate-900">{row.staffCode}</TableCell>
                        <TableCell className="p-3 text-xs font-extrabold text-slate-700 uppercase truncate max-w-[160px]">{row.fullName}</TableCell>
                        {row.dailyBreakdown.map((day, dayIdx) => {
                          let displayStyle = "text-slate-400 font-normal";
                          if (!day.isAbsent) {
                            displayStyle = day.isLate 
                              ? "text-amber-600 font-bold bg-amber-50/40" 
                              : "text-emerald-600 font-bold bg-emerald-50/30";
                          } else {
                            displayStyle = "text-rose-400/80 font-normal bg-rose-50/20";
                          }
                          return (
                            <TableCell key={dayIdx} className={`p-3 text-center font-mono text-xs transition-all ${displayStyle}`}>
                              {day.label}
                            </TableCell>
                          );
                        })}
                        <TableCell className="p-3 text-center font-mono font-black text-xs bg-emerald-50 text-emerald-900 border-l">{row.grandTotalLabel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}