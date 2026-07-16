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
  Layers
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EmployeeProfile {
  staffCode: string;
  fullName: string;
  department: string;
  costCenter: string;
  subCenter: string; // e.g., 'Evulation'
  subItem: string;    // e.g., 'Wholebirds'
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

type ComplianceFilterMode = "ALL" | "ON_TIME" | "ABSENT" | "LATE" | "ONSITE";

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

  const subCentersList = [
    "All",
    "Receiving",
    "Plucking",
    "Evisceration",
    "Processing",
    "IQF Material",
    "Day Cleaners",
    "Whole Bird",
    "Quality Control",
    "Bailing",
    "Night Cleaners",
    "Loading",
    "Dispatch",
    "Date Coding",
    "Live Sales",
  ];

  const subItemsList = [
    "All",
    "Fillets",
    "Mixed Portion",
    "Drumsticks",
    "Cutlets",
    "Wings",
  ];

  const isSubItemApplicable = (subCenter: string) => subCenter === "Processing";

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

  const [selectedSubCenter, setSelectedSubCenter] = useState<string>("All");
  const [selectedSubItem, setSelectedSubItem] = useState<string>("All");

  useEffect(() => {
    if (!isSubItemApplicable(selectedSubCenter) && selectedSubItem !== "All") {
      setSelectedSubItem("All");
    }
  }, [selectedSubCenter, selectedSubItem]);

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
      .filter((emp) => {
        const deptMatch = emp.department === selectedDept;
        const ccMatch = emp.costCenter === selectedCC;

        const subCenterMatch =
          selectedSubCenter === "All" ||
          String(emp.subCenter).trim().toLowerCase() === String(selectedSubCenter).trim().toLowerCase();

        const subItemMatch =
          selectedSubItem === "All" ||
          String(emp.subItem).trim().toLowerCase() === String(selectedSubItem).trim().toLowerCase();

        return deptMatch && ccMatch && subCenterMatch && subItemMatch;
      })
      .map((emp) => {
        let cumulativeRegular = 0;
        let cumulativeOvertime = 0;
        
        let dynamicOnsiteCount = 0;
        let dynamicLateCount = 0;
        let dynamicOnTimeCount = 0;
        let dynamicAbsentCount = 0;

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

          // 1. ABSENT: No raw swipes whatsoever
          if (daySwipes.length === 0) {
            const isFuture = dateStr > todayStr;
            const isAbsentMark = !isWeekend && !isFuture;
            if (isAbsentMark) dynamicAbsentCount++;
            return { label: "0.0 / 0.0", isAbsent: isAbsentMark, isLate: false, isOnTime: false };
          }

          // 2. SINGLE PUNCH: Exactly one punch is found, treat as late
          if (daySwipes.length === 1) {
            dynamicLateCount++;
            dynamicOnsiteCount++; // Counted as active onsite record, but late
            return {
              label: "0.0 / 0.0",
              isAbsent: false,
              isLate: true,
              isOnTime: false
            };
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

          // MISSING PUNCH HANDLING: If there is no clear IN or OUT swipe pairs
          if (ins.length === 0 || outs.length === 0) {
            const sortedFallback = [...daySwipes].sort((a, b) => String(a.time).localeCompare(String(b.time)));
            // Try to extract chronological IN/OUT from general day swipes
            if (sortedFallback.length >= 2) {
              ins.push(sortedFallback[0]);
              outs.push(sortedFallback[sortedFallback.length - 1]);
            } else {
              // Less than 2 swipes fallback is not possible, meaning they missed punches -> Regard as absent
              const isAbsentMark = !isWeekend && dateStr <= todayStr;
              if (isAbsentMark) dynamicAbsentCount++;
              return { label: "0.0 / 0.0", isAbsent: isAbsentMark, isLate: false, isOnTime: false };
            }
          }

          const firstInTime = ins[0].time;
          const lastOutTime = outs[outs.length - 1].time;

          const [inH, inM] = firstInTime.split(":").map(Number);
          const [outH, outM] = lastOutTime.split(":").map(Number);

          if (isNaN(inH) || isNaN(outH)) {
            const isAbsentMark = !isWeekend && dateStr <= todayStr;
            if (isAbsentMark) dynamicAbsentCount++;
            return { label: "0.0 / 0.0", isAbsent: isAbsentMark, isLate: false, isOnTime: false };
          }

          const rawTotalHours = (outH * 60 + outM - (inH * 60 + inM)) / 60;
          const totalHoursAfterLunch = Math.max(0, rawTotalHours - 1); 

          if (totalHoursAfterLunch <= 0) {
            dynamicAbsentCount++;
            return { label: "0.0 / 0.0", isAbsent: true, isLate: false, isOnTime: false };
          }

          let worked = totalHoursAfterLunch > currentDayCap ? currentDayCap : totalHoursAfterLunch;
          let ot = totalHoursAfterLunch > currentDayCap ? totalHoursAfterLunch - currentDayCap : 0;

          cumulativeRegular += worked;
          cumulativeOvertime += ot;
          dynamicOnsiteCount++;

          // 3. LATE SHIFT rule: came after 7:20
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
            isOnTime: !isLateShift
          };
        });

        return {
          ...emp,
          dailyBreakdown,
          dynamicOnTimeCount,
          dynamicLateCount,
          dynamicAbsentCount,
          dynamicOnsiteCount,
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
    selectedSubItem,
  ]);

  const aggregateMetrics = useMemo(() => {
    let totalWorkforce = fullyCalculatedDataset.length;
    let onsiteTotal = 0;
    let onTimeTotal = 0;
    let absentTotal = 0;
    let lateTotal = 0;

    fullyCalculatedDataset.forEach(row => {
      if (row.dynamicOnsiteCount > 0) onsiteTotal++;
      if (row.dynamicOnTimeCount > 0) onTimeTotal++;
      if (row.dynamicLateCount > 0) lateTotal++;
      if (row.dynamicOnsiteCount === 0 && row.dynamicAbsentCount > 0) absentTotal++;
    });

    return { totalWorkforce, onTimeTotal, absentTotal, lateTotal, onsiteTotal };
  }, [fullyCalculatedDataset]);

  const processedTimesheetData = useMemo(() => {
    return fullyCalculatedDataset.filter(row => {
      if (complianceFilter === "ONSITE") return row.dynamicOnsiteCount > 0;
      if (complianceFilter === "ABSENT") return row.dynamicOnsiteCount === 0 && row.dynamicAbsentCount > 0;
      if (complianceFilter === "LATE") return row.dynamicLateCount > 0;
      if (complianceFilter === "ON_TIME") return row.dynamicOnTimeCount > 0;
      return true;
    });
  }, [fullyCalculatedDataset, complianceFilter]);

  const handleDownloadReport = async () => {
    if (!processedTimesheetData || processedTimesheetData.length === 0) {
      alert("No active timesheet data available to export.");
      return;
    }
    setIsDownloadingPdf(true);
    
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.src = "/gofresh_logo.jpg";
        img.onload = () => {
          doc.addImage(img, "JPEG", 12, 12, 14, 14);
          resolve();
        };
        img.onerror = () => {
          console.warn("Logo asset missing from /public/gofresh_logo.jpg. Falling back to corporate typography text.");
          doc.setTextColor(30, 41, 59).setFont("helvetica", "bold").setFontSize(22).text("Go", 12, 22);
          doc.setTextColor(21, 128, 61).text("Fresh", 23, 22);
          resolve();
        };
      });

      doc.setTextColor(148, 163, 184).setFontSize(7.5).setFont("helvetica", "bold").text("OPERATIONAL TIMESHEET ARCHIVE", 12, 31);
      doc.setTextColor(21, 128, 61).setFontSize(11).text("TIMESHEET SUMMARY", 285, 15, { align: "right" });

      doc.setTextColor(71, 85, 105).setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Department: ${selectedDept}`, 285, 20, { align: "right" });
      const subCenterLabel = selectedSubCenter === "All" ? "All Sub Centers" : selectedSubCenter;
      const subItemLabel = selectedSubItem === "All" ? "" : ` / ${selectedSubItem}`;
      doc.text(`Cost Centre: ${selectedCC} (${subCenterLabel}${subItemLabel})`, 285, 24, { align: "right" });
      doc.text(`Period Frame: ${startDate} to ${endDate}`, 285, 28, { align: "right" });

      doc.setDrawColor(226, 232, 240).setLineWidth(0.5).line(12, 34, 285, 34);

      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const tableHeaders = ["Staff Code", "Full Name", "Sub Center", "Sub Item"];

      customRangeDatesArray.forEach((dateStr) => {
        const d = new Date(dateStr);
        tableHeaders.push(`${weekdays[d.getDay()]} ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}`);
      });
      tableHeaders.push("Total (Reg/OT)");

      const tableBody = processedTimesheetData.map((row) => {
        const dataCells = [
          row.staffCode.toUpperCase(),
          row.fullName.toUpperCase(),
          row.subCenter ? row.subCenter.toUpperCase() : "—",
          row.subItem ? row.subItem.toUpperCase() : "—",
        ];
        row.dailyBreakdown.forEach((day) => dataCells.push(day.label));
        dataCells.push(row.grandTotalLabel);
        return dataCells;
      });

      autoTable(doc, {
        startY: 38,
        margin: { left: 12, right: 12 },
        head: [tableHeaders],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", halign: "center" },
        styles: { fontSize: 8, cellPadding: 2.5, halign: "center", valign: "middle" },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const cellValue = String(data.cell.raw || "").trim();
          if (data.column.index === tableHeaders.length - 1) {
            if (cellValue !== "0.0 / 0.0" && cellValue !== "") {
              data.cell.styles.fillColor = [209, 250, 229];
              data.cell.styles.textColor = [6, 78, 59];
              data.cell.styles.fontStyle = "bold";
            }
          } else if (data.column.index >= 4) {
            if (cellValue !== "0.0 / 0.0" && cellValue !== "") {
              data.cell.styles.textColor = [5, 150, 105];
              data.cell.styles.fillColor = [240, 253, 250];
            }
          }
        },
      });

      doc.save(`GoFresh_Timesheet_${selectedDept.replace(/\s+/g, "_")}_${startDate}.pdf`);
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
              <Building2 className="w-4 h-4 text-green-700" /> GoFresh Department Cascade Selector
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* 1. DEPARTMENT */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                1. Select Active Department
              </label>
              <div className="border rounded-lg divide-y divide-slate-100 overflow-hidden shadow-xs">
                {departmentsList.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`w-full text-left px-3 py-2 text-xs font-bold uppercase transition-colors ${
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

            {/* 2. COST CENTER */}
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

            {/* 3. SUB CENTER */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                3. Sub Center Classification
              </label>
              <select
                value={selectedSubCenter}
                onChange={(e) => setSelectedSubCenter(e.target.value)}
                className="w-full bg-white border h-10 text-xs font-bold rounded-lg px-3 uppercase text-slate-800 focus:outline-green-700 shadow-xs"
              >
                {subCentersList.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. SUB ITEM */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Layers className="w-3 h-3 text-green-700" /> 4. Targeted Sub-Item Line
              </label>
              <select
                value={selectedSubItem}
                onChange={(e) => setSelectedSubItem(e.target.value)}
                disabled={!isSubItemApplicable(selectedSubCenter)}
                className="w-full bg-white border h-10 text-xs font-bold rounded-lg px-3 uppercase text-slate-800 focus:outline-green-700 shadow-xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {subItemsList.map((si) => (
                  <option key={si} value={si}>
                    {si}
                  </option>
                ))}
              </select>
              {!isSubItemApplicable(selectedSubCenter) && (
                <p className="text-[10px] text-slate-400 font-medium">
                  Only applicable when Sub Center is &quot;Processing&quot;
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- COMPLIANCE METRICS ROW --- */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
          <button onClick={() => setComplianceFilter("ALL")} className={`p-4 text-left border rounded-xl transition-all flex items-center justify-between ${complianceFilter === "ALL" ? "bg-slate-900 border-slate-900 text-white" : "bg-white text-slate-700"}`}>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Workforce</p>
              <p className="text-xl font-extrabold mt-0.5">{aggregateMetrics.totalWorkforce}</p>
            </div>
            <Users className="w-5 h-5" />
          </button>

          <button onClick={() => setComplianceFilter("ONSITE")} className={`p-4 text-left border rounded-xl transition-all flex items-center justify-between ${complianceFilter === "ONSITE" ? "bg-blue-900 text-blue-50" : "bg-white text-slate-700"}`}>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Onsite</p>
              <p className="text-xl font-extrabold text-blue-600 mt-0.5">{aggregateMetrics.onsiteTotal}</p>
            </div>
            <MapPin className="w-5 h-5 text-blue-500" />
          </button>

          <button onClick={() => setComplianceFilter("ON_TIME")} className={`p-4 text-left border rounded-xl transition-all flex items-center justify-between ${complianceFilter === "ON_TIME" ? "bg-emerald-900 text-emerald-50" : "bg-white text-slate-700"}`}>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">On Time</p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{aggregateMetrics.onTimeTotal}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </button>

          <button onClick={() => setComplianceFilter("LATE")} className={`p-4 text-left border rounded-xl transition-all flex items-center justify-between ${complianceFilter === "LATE" ? "bg-amber-900 text-amber-50" : "bg-white text-slate-700"}`}>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Late</p>
              <p className="text-xl font-extrabold text-amber-600 mt-0.5">{aggregateMetrics.lateTotal}</p>
            </div>
            <Clock className="w-5 h-5 text-amber-500" />
          </button>
        </div>

        {/* --- ROSTER DATA SUMMARY --- */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="p-4 bg-slate-50/50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-1.5 flex-wrap">
              <span>Roster Grid:</span> 
              <span className="text-green-700">{selectedDept}</span> &rarr;{" "}
              <span className="text-green-700">{selectedCC}</span> &rarr;{" "}
              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {selectedSubCenter === "All" ? "All Sub Centers" : selectedSubCenter}
              </span> &rarr;{" "}
              <span className="text-green-700 font-black">
                {selectedSubItem === "All" ? "All Sub Items" : selectedSubItem}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-white p-2 border rounded-xl shadow-xs">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase px-1">From:</span>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs font-mono font-bold border-none bg-transparent p-1 focus-visible:ring-0" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase px-1">To:</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs font-mono font-bold border-none bg-transparent p-1 focus-visible:ring-0" />
              </div>
              <Button size="sm" onClick={handleDownloadReport} disabled={isDownloadingPdf || processedTimesheetData.length === 0} className="h-8 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700">
                {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                <span>Report</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {processedTimesheetData.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold uppercase text-slate-400 bg-slate-50/30">
                No workers match selection criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 border-b text-slate-400 text-[10px] font-black uppercase">
                    <TableRow>
                      <TableHead className="w-[100px] p-3">Staff Code</TableHead>
                      <TableHead className="w-[160px] p-3">Full Name</TableHead>
                      <TableHead className="w-[120px] p-3">Sub Center</TableHead>
                      <TableHead className="w-[110px] p-3">Sub Item</TableHead>
                      {customRangeDatesArray.map((dateStr) => {
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
                        <TableCell className="p-3 text-xs font-bold text-blue-700 uppercase">
                          {row.subCenter ? row.subCenter : <span className="text-slate-300 font-medium normal-case">&mdash;</span>}
                        </TableCell>
                        <TableCell className="p-3 text-xs font-bold text-green-700 uppercase">
                          {row.subItem ? row.subItem : <span className="text-slate-300 font-medium normal-case">&mdash;</span>}
                        </TableCell>
                        {row.dailyBreakdown.map((day, dayIdx) => {
                          let displayStyle = "text-slate-400";
                          if (!day.isAbsent) displayStyle = day.isLate ? "text-amber-600 font-bold bg-amber-50/40" : "text-emerald-600 font-bold bg-emerald-50/30";
                          else displayStyle = "text-rose-400 bg-rose-50/20";
                          return (
                            <TableCell key={dayIdx} className={`p-3 text-center font-mono text-xs ${displayStyle}`}>{day.label}</TableCell>
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