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
  MapPin,
  AlertCircle
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

interface OnsiteStaffRecord {
  id: string;
  date: string;
  time: string;
}

type ComplianceFilterMode = "ALL" | "ON_TIME" | "ABSENT" | "LATE" | "ONSITE" | "MISSED_PUNCH";

export default function EMSTimesheetDashboard() {
  const departmentStructure: Record<string, string[]> = {
    "Go Fresh Chicken": [
      "Chicken Abattoir",
      "Blantyre Sales",
      "Lilongwe Sales",
      "Live Sales Lilongwe",
      "Lilongwe Production",
      "Kanengo Farm"
    ],
    "Go Fresh Beef": [
      "Lilongwe House",
      "Lilongwe LCS",
      "Lilongwe Sales",
      "Lilongwe Production",
      "Ngabu General",
      "Blantyre Sales",
      "Blantyre Production",
    ],
    "Tray Factory": ["GF Tray Factory", "GF Retail"],
    "Retail": ["Blantyre Sales", "Lilongwe Sales", "GF Retail"],
    "Live Sales": [
      "Live Sales Lilongwe",
      "Lilongwe Sales",
      "Blantyre Production",
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

  // Default to single-day layout viewing (Today)
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilterMode>("ALL");

  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([]);
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);
  const [onsiteStaffBuffer, setOnsiteStaffBuffer] = useState<OnsiteStaffRecord[]>([]);
  
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(true);
  const [isLoadingOnsite, setIsLoadingOnsite] = useState<boolean>(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Computes exact array of dates from user input range bounds
  const customRangeDatesArray = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return dates;

    const loop = new Date(start);
    while (loop <= end) {
      dates.push(loop.toISOString().split("T")[0]);
      loop.setDate(loop.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

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

  useEffect(() => {
    async function fetchOnsiteStaff() {
      setIsLoadingOnsite(true);
      try {
        const res = await fetch("/api/attendance/onsite");
        if (res.ok) {
          const data = await res.json();
          setOnsiteStaffBuffer(data.staff || []);
        }
      } catch (err) {
        console.error("Failed fetching onsite staff payload", err);
      } finally {
        setIsLoadingOnsite(false);
      }
    }
    fetchOnsiteStaff();
  }, []);

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
        
        let dynamicOnsiteCount = 0;
        let dynamicLateCount = 0;
        let dynamicOnTimeCount = 0;
        let dynamicAbsentCount = 0;
        let dynamicMissedPunchCount = 0;

        const currentStaffCodeClean = String(emp.staffCode).trim().toLowerCase();

        const dailyBreakdown = customRangeDatesArray.map((dateStr) => {
          const daySwipes = rawSwipesBuffer.filter((s) => {
            const matchId = String(s.id).trim().toLowerCase() === currentStaffCodeClean;
            const matchDate = String(s.date).trim() === String(dateStr).trim();
            return matchId && matchDate;
          });

          const checkDate = new Date(dateStr);
          const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6; 
          const currentDayCap = isWeekend ? 5.5 : 8.5;

          if (daySwipes.length === 0) {
            const isFuture = dateStr > todayStr;
            const isAbsentMark = !isWeekend && !isFuture;
            
            if (isAbsentMark) dynamicAbsentCount++;

            return { label: "0.0 / 0.0", isAbsent: isAbsentMark, isLate: false, isOnTime: false, isMissedPunch: false };
          }

          const ins = daySwipes
            .filter((s) => {
              const t = String(s.type).toUpperCase().trim();
              return t === "CHECK IN" || t === "IN" || t.includes("IN");
            })
            .sort((a, b) => String(a.time).localeCompare(String(b.time)));

          const outs = daySwipes
            .filter((s) => {
              const t = String(s.type).toUpperCase().trim();
              return t === "CHECK OUT" || t === "OUT" || t.includes("OUT");
            })
            .sort((a, b) => String(a.time).localeCompare(String(b.time)));

          if (ins.length === 0 || outs.length === 0) {
            const sortedFallback = [...daySwipes].sort((a, b) => String(a.time).localeCompare(String(b.time)));
            if (sortedFallback.length >= 2) {
              ins.push(sortedFallback[0]);
              outs.push(sortedFallback[sortedFallback.length - 1]);
            } else {
              dynamicMissedPunchCount++;
              dynamicOnsiteCount++; // Physically onsite since logs exist
              return { label: "MISSED", isAbsent: false, isLate: false, isOnTime: false, isMissedPunch: true };
            }
          }

          const firstInTime = ins[0].time;
          const lastOutTime = outs[outs.length - 1].time;

          const [inH, inM] = firstInTime.split(":").map(Number);
          const [outH, outM] = lastOutTime.split(":").map(Number);

          if (isNaN(inH) || isNaN(outH)) {
            dynamicMissedPunchCount++;
            dynamicOnsiteCount++;
            return { label: "MISSED", isAbsent: false, isLate: false, isOnTime: false, isMissedPunch: true };
          }

          const rawTotalHours = (outH * 60 + outM - (inH * 60 + inM)) / 60;
          const totalHoursAfterLunch = Math.max(0, rawTotalHours - 1); 

          if (totalHoursAfterLunch <= 0) {
            dynamicAbsentCount++;
            return { label: "0.0 / 0.0", isAbsent: true, isLate: false, isOnTime: false, isMissedPunch: false };
          }

          let worked = totalHoursAfterLunch > currentDayCap ? currentDayCap : totalHoursAfterLunch;
          let ot = totalHoursAfterLunch > currentDayCap ? totalHoursAfterLunch - currentDayCap : 0;

          cumulativeRegular += worked;
          cumulativeOvertime += ot;

          dynamicOnsiteCount++;

          const isLateShift = (inH > 7 || (inH === 7 && inM > 30));
          if (isLateShift) {
            dynamicLateCount++;
          } else {
            dynamicOnTimeCount++;
          }

          return {
            label: `${worked.toFixed(1)} / ${ot.toFixed(1)}`,
            isAbsent: false,
            isLate: isLateShift,
            isOnTime: !isLateShift,
            isMissedPunch: false
          };
        });

        return {
          ...emp,
          dailyBreakdown,
          dynamicOnTimeCount,
          dynamicLateCount,
          dynamicAbsentCount,
          dynamicOnsiteCount,
          dynamicMissedPunchCount,
          grandTotalLabel: `${cumulativeRegular.toFixed(1)} / ${cumulativeOvertime.toFixed(1)}`,
        };
      });
  }, [
    employeeDirectory,
    rawSwipesBuffer,
    customRangeDatesArray,
    selectedDept,
    selectedCC,
    selectedSubCenter,
  ]);

  // FIXED: Metric logic modified to prevent double counting across date windows
  const aggregateMetrics = useMemo(() => {
    let totalWorkforce = fullyCalculatedDataset.length;
    let onsiteTotal = 0;
    let onTimeTotal = 0;
    let absentTotal = 0;
    let lateTotal = 0;
    let missedPunchTotal = 0;

    fullyCalculatedDataset.forEach(row => {
      if (row.dynamicOnsiteCount > 0) onsiteTotal++;
      if (row.dynamicOnTimeCount > 0) onTimeTotal++;
      if (row.dynamicLateCount > 0) lateTotal++;
      if (row.dynamicMissedPunchCount > 0) missedPunchTotal++;
      
      // An employee is exclusively absent if they have no onsite presence records during this period frame
      if (row.dynamicOnsiteCount === 0 && row.dynamicAbsentCount > 0) {
        absentTotal++;
      }
    });

    return { totalWorkforce, onTimeTotal, absentTotal, lateTotal, onsiteTotal, missedPunchTotal };
  }, [fullyCalculatedDataset]);

  // FIXED: Added identical contextual filtering constraint for the data grid row render mapping
  const processedTimesheetData = useMemo(() => {
    return fullyCalculatedDataset.filter(row => {
      if (complianceFilter === "ONSITE") return row.dynamicOnsiteCount > 0;
      if (complianceFilter === "ABSENT") return row.dynamicOnsiteCount === 0 && row.dynamicAbsentCount > 0;
      if (complianceFilter === "LATE") return row.dynamicLateCount > 0;
      if (complianceFilter === "ON_TIME") return row.dynamicOnTimeCount > 0;
      if (complianceFilter === "MISSED_PUNCH") return row.dynamicMissedPunchCount > 0;
      return true;
    });
  }, [fullyCalculatedDataset, complianceFilter]);

  const isDataSyncing = isLoadingEmployees || isLoadingAttendance || isLoadingOnsite;

  const handleDownloadReport = async () => {
    if (!processedTimesheetData || processedTimesheetData.length === 0) {
      alert("No active timesheet data available to export. Adjust filters.");
      return;
    }

    setIsDownloadingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Go", 12, 22);
      doc.setTextColor(21, 128, 61);
      doc.text("Fresh", 23, 22);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("OPERATIONAL TIMESHEET ARCHIVE", 12, 31);

      doc.setTextColor(21, 128, 61);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("TIMESHEET SUMMARY", 285, 15, { align: "right" });

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Department: ${selectedDept}`, 285, 20, { align: "right" });
      doc.text(`Cost Centre: ${selectedCC} (${selectedSubCenter})`, 285, 24, {
        align: "right",
      });
      doc.text(`Period Frame: ${startDate} to ${endDate}`, 285, 28, {
        align: "right",
      });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(12, 34, 285, 34);

      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const tableHeaders = ["Staff Code", "Full Name"];

      customRangeDatesArray.forEach((dateStr) => {
        const d = new Date(dateStr);
        const dayName = weekdays[d.getDay()];
        const formattedShortDate = d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
        });
        tableHeaders.push(`${dayName} ${formattedShortDate}`);
      });

      tableHeaders.push("Total (Reg/OT)");

      const tableBody = processedTimesheetData.map((row) => {
        const dataCells = [
          row.staffCode.toUpperCase(),
          row.fullName.toUpperCase(),
        ];

        row.dailyBreakdown.forEach((day) => {
          dataCells.push(day.label);
        });

        dataCells.push(row.grandTotalLabel);
        return dataCells;
      });

      autoTable(doc, {
        startY: 38,
        margin: { left: 12, right: 12 },
        head: [tableHeaders],
        body: tableBody,
        theme: "striped",
        headStyles: {
          fillColor: [20, 83, 45],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center",
         },
        columnStyles: {
          0: { fontStyle: "bold", halign: "left" },
          1: { fontStyle: "bold", halign: "left" },
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          halign: "center",
          valign: "middle",
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;

          const cellValue = String(data.cell.raw || "").trim();
          const isTotalColumn = data.column.index === tableHeaders.length - 1;

          if (isTotalColumn) {
            if (cellValue !== "0.0 / 0.0" && cellValue !== "") {
              data.cell.styles.fillColor = [209, 250, 229]; 
              data.cell.styles.textColor = [6, 78, 59];    
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.fillColor = [248, 250, 252]; 
              data.cell.styles.textColor = [148, 163, 184]; 
            }
          } else if (data.column.index >= 2) {
            if (cellValue === "MISSED") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [254, 242, 242];
            } else if (cellValue !== "0.0 / 0.0" && cellValue !== "") {
              data.cell.styles.textColor = [5, 150, 105];   
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 253, 250]; 
            } else {
              data.cell.styles.textColor = [148, 163, 184]; 
            }
          }
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.setFont("helvetica", "normal");
          doc.text(`Page ${data.pageNumber}`, 285, 203, { align: "right" });
          doc.text(
            "GoFresh Automation System • Secure Client Ledger Matrix",
            12,
            203,
          );
        },
      });

      const safeFileName = `GoFresh_Timesheet_${selectedDept.replace(/\s+/g, "_")}_${startDate}.pdf`;
      doc.save(safeFileName);
    } catch (err) {
      console.error("PDF Export Error context:", err);
      alert("Could not compile layout matrix PDF locally.");
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                1. Select Active Department
              </label>
              <div className="border rounded-lg divide-y divide-slate-100 overflow-hidden shadow-xs">
                {departmentsList.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`w-full text-left px-3 py-2.5 text-xs font-bold uppercase transition-colors ${
                      selectedDept === dept
                        ? "bg-green-700 text-white"
                        : "bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                2. Filter By Cost Center
              </label>
              <select
                value={selectedCC}
                onChange={(e) => setSelectedCC(e.target.value)}
                className="w-full bg-white border h-10 text-xs font-bold rounded-lg px-3 uppercase text-slate-800 focus:outline-green-700 shadow-xs"
              >
                {activeCostCenters.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                3. Sub Center
              </label>
              <select
                value={selectedSubCenter}
                onChange={(e) => setSelectedSubCenter(e.target.value)}
                className="w-full bg-white border h-10 text-xs font-bold rounded-lg px-3 uppercase text-slate-800 focus:outline-green-700 shadow-xs"
              >
                <option value="Fillet">Fillet</option>
                <option value="Evulation">Evulation</option>
                <option value="Processing">Processing</option>
                <option value="Evisceration">Evisceration</option>
                <option value="Plucking And Scolding">Live Sales</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* --- DYNAMIC INTERACTIVE COMPLIANCE METRICS ROW --- */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 w-full">
          <button
            onClick={() => setComplianceFilter("ALL")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ALL"
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selected Workforce</p>
              <p className="text-xl font-extrabold mt-0.5">{aggregateMetrics.totalWorkforce}</p>
            </div>
            <Users className={`w-5 h-5 ${complianceFilter === "ALL" ? "text-green-400" : "text-slate-400"}`} />
          </button>

          <button
            onClick={() => setComplianceFilter("ONSITE")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ONSITE"
                ? "bg-blue-900 border-blue-800 text-blue-50"
                : "bg-white border-slate-200 hover:bg-blue-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workforce Onsite</p>
              <p className="text-xl font-extrabold text-blue-600 mt-0.5">{aggregateMetrics.onsiteTotal}</p>
            </div>
            <MapPin className="w-5 h-5 text-blue-500" />
          </button>

          <button
            onClick={() => setComplianceFilter("ON_TIME")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ON_TIME"
                ? "bg-emerald-900 border-emerald-800 text-emerald-50"
                : "bg-white border-slate-200 hover:bg-emerald-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workforce On Time</p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{aggregateMetrics.onTimeTotal}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </button>

          <button
            onClick={() => setComplianceFilter("LATE")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "LATE"
                ? "bg-amber-900 border-amber-800 text-amber-50"
                : "bg-white border-slate-200 hover:bg-amber-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workforce Late</p>
              <p className="text-xl font-extrabold text-amber-600 mt-0.5">{aggregateMetrics.lateTotal}</p>
            </div>
            <Clock className="w-5 h-5 text-amber-500" />
          </button>

          <button
            onClick={() => setComplianceFilter("MISSED_PUNCH")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "MISSED_PUNCH"
                ? "bg-purple-900 border-purple-800 text-purple-50"
                : "bg-white border-slate-200 hover:bg-purple-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Missed Punches</p>
              <p className="text-xl font-extrabold text-purple-600 mt-0.5">{aggregateMetrics.missedPunchTotal}</p>
            </div>
            <AlertCircle className="w-5 h-5 text-purple-500" />
          </button>

          <button
            onClick={() => setComplianceFilter("ABSENT")}
            className={`p-4 text-left border rounded-xl transition-all shadow-xs flex items-center justify-between ${
              complianceFilter === "ABSENT"
                ? "bg-rose-900 border-rose-800 text-rose-50"
                : "bg-white border-slate-200 hover:bg-rose-50/40 text-slate-700"
            }`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workforce Absent</p>
              <p className="text-xl font-extrabold text-rose-600 mt-0.5">{aggregateMetrics.absentTotal}</p>
            </div>
            <XCircle className="w-5 h-5 text-rose-500" />
          </button>
        </div>

        {/* --- MAIN ROSTER DATA SUMMARY --- */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="p-4 bg-slate-50/50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-2 flex-wrap">
              <span>Timesheet Overview:</span> 
              <span className="text-green-700">{selectedDept}</span> &rarr;{" "}
              <span className="text-green-700">{selectedCC}</span> &rarr;{" "}
              <span className="text-green-700">{selectedSubCenter}</span>
              {complianceFilter !== "ALL" && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black border border-blue-200 uppercase">
                  Active Filter: {complianceFilter.replace("_", " ")}
                </span>
              )}
              {isDataSyncing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-white p-2 border rounded-xl shadow-xs">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase px-1">
                  From:
                </span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs font-mono font-bold border-none bg-transparent p-1 focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase px-1">
                  To:
                </span>
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
                disabled={
                  isDownloadingPdf || processedTimesheetData.length === 0
                }
                className="h-8 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>
                  {isDownloadingPdf ? "Compiling PDF..." : "Download Report"}
                </span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {processedTimesheetData.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/30">
                {isDataSyncing
                  ? "Syncing database data shards..."
                  : "No workers match the chosen compliance status selection criteria."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 border-b text-slate-400 text-[10px] font-black uppercase tracking-wider">
                    <TableRow>
                      <TableHead className="w-[100px] p-3">
                        Staff Code
                      </TableHead>
                      <TableHead className="w-[160px] p-3">Full Name</TableHead>
                      {customRangeDatesArray.map((dateStr) => {
                        const d = new Date(dateStr);
                        const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                        const formattedShortDate = d.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                        });
                        return (
                          <TableHead key={dateStr} className="text-center p-3 font-bold">
                            {dayName} {formattedShortDate}
                          </TableHead>
                        );
                      })}
                      <TableHead className="text-center p-3 font-extrabold bg-emerald-50 text-emerald-900 border-l">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedTimesheetData.map((row) => (
                      <TableRow
                        key={row.staffCode}
                        className="hover:bg-slate-50/50"
                      >
                        <TableCell className="p-3 font-mono font-bold text-xs text-slate-900">
                          {row.staffCode}
                        </TableCell>
                        <TableCell className="p-3 text-xs font-extrabold text-slate-700 uppercase truncate max-w-[160px]">
                          {row.fullName}
                        </TableCell>

                        {row.dailyBreakdown.map((day, dayIdx) => {
                          let displayStyle = "text-slate-400 font-normal";
                          
                          if (day.isMissedPunch) {
                            displayStyle = "text-purple-600 font-bold bg-purple-50/40 drop-shadow-[0_0_6px_rgba(147,51,234,0.1)]";
                          } else if (!day.isAbsent) {
                            if (day.isLate) {
                              displayStyle = "text-amber-600 font-bold bg-amber-50/40 drop-shadow-[0_0_6px_rgba(217,119,6,0.1)]";
                            } else {
                              displayStyle = "text-emerald-600 font-bold bg-emerald-50/30 drop-shadow-[0_0_6px_rgba(5,150,105,0.2)]";
                            }
                          } else {
                            displayStyle = "text-rose-400/80 font-normal bg-rose-50/20";
                          }

                          return (
                            <TableCell
                              key={dayIdx}
                              className={`p-3 text-center font-mono text-xs transition-all ${displayStyle}`}
                            >
                              {day.label}
                            </TableCell>
                          );
                        })}

                        <TableCell className="p-3 text-center font-mono font-black text-xs bg-emerald-50 text-emerald-900 border-l drop-shadow-[0_0_8px_rgba(4,120,87,0.1)]">
                          {row.grandTotalLabel}
                        </TableCell>
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