"use client";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  Building2, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Users,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Calendar
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EmployeeProfile {
  staffCode: string;
  fullName: string;
  department: string;
  costCenter: string;
  subCenter: string; 
  subItem: string;    
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

type MetricFilterMode = "ALL" | "ON_TIME" | "ABSENT" | "LATE" | "ONSITE";

// Helper function to convert an image path to base64 string
const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string), false);
    reader.addEventListener("error", () => reject(new Error("Failed to convert image to base64")));
    reader.readAsDataURL(blob);
  });
};

export default function Overview() {
  const subCentersList = ["All", "Receiving", "Plucking", "Evisceration", "Processing", "IQF Material", "Day Cleaners", "Whole Bird", "Quality Control", "Bailing", "Night Cleaners", "Loading", "Dispatch", "Date Coding", "Live Sales"];
  const subItemsList = ["All", "Fillets", "Mixed Portion", "Drumsticks", "Cutlets", "Wings"];
  const isSubItemApplicable = (subCenter: string) => subCenter === "Processing";
  
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 7);
    return d.toISOString().split("T")[0];
  });

  const [selectedMetricFilter, setSelectedMetricFilter] = useState<MetricFilterMode>("ALL");
  const [reportDept, setReportDept] = useState<string>("ALL");
  const [reportCC, setReportCC] = useState<string>("ALL");
  
  const [selectedSubCenter, setSelectedSubCenter] = useState<string>("All");
  const [selectedSubItem, setSelectedSubItem] = useState<string>("All");

  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([]);
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);
  const [, setOnsiteStaffBuffer] = useState<OnsiteStaffRecord[]>([]);
  
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(true);
  const [, setIsLoadingOnsite] = useState<boolean>(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isDownloadingAllPdf, setIsDownloadingAllPdf] = useState<boolean>(false);

  const targetWeekDays = useMemo(() => {
    const days: { dayName: string; dateStr: string }[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return days;
    }

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentLoop = new Date(start);
    
    let iterations = 0;
    while (currentLoop <= end && iterations < 31) {
      const currentStr = currentLoop.toISOString().split("T")[0];
      days.push({
        dayName: weekdays[currentLoop.getDay()],
        dateStr: currentStr
      });
      currentLoop.setDate(currentLoop.getDate() + 1);
      iterations++;
    }
    return days;
  }, [fromDate, toDate]);

  useEffect(() => {
    setReportCC("ALL");
    setSelectedSubCenter("All");
    setSelectedSubItem("All");
  }, [reportDept]);

  useEffect(() => {
    setSelectedSubCenter("All");
    setSelectedSubItem("All");
  }, [reportCC]);

  useEffect(() => {
    if (!isSubItemApplicable(selectedSubCenter) && selectedSubItem !== "All") {
      setSelectedSubItem("All");
    }
  }, [selectedSubCenter, selectedSubItem]);

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
      if (!fromDate || !toDate) return;
      setIsLoadingAttendance(true);
      try {
        const url = `/api/attendance?startDate=${fromDate}&endDate=${toDate}&size=50000`;
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
  }, [fromDate, toDate]);

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

  const distinctCostCenters = useMemo(() => {
    if (reportDept === "ALL") return [];
    return Array.from(
      new Set(
        employeeDirectory
          .filter((e) => e.department === reportDept)
          .map((e) => e.costCenter)
      )
    ).filter(Boolean);
  }, [employeeDirectory, reportDept]);

  const distinctSubCenters = useMemo(() => {
    if (reportCC === "ALL") return [];
    return Array.from(
      new Set(
        employeeDirectory
          .filter((e) => e.department === reportDept && e.costCenter === reportCC)
          .map((e) => e.subCenter)
      )
    ).filter(Boolean);
  }, [employeeDirectory, reportDept, reportCC]);

  const distinctSubItems = useMemo(() => {
    if (reportCC === "ALL") return [];
    return Array.from(
      new Set(
        employeeDirectory
          .filter((e) => e.department === reportDept && e.costCenter === reportCC)
          .map((e) => e.subItem)
      )
    ).filter(Boolean);
  }, [employeeDirectory, reportDept, reportCC]);

  const fullyCalculatedDataset = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    return employeeDirectory
      .filter((emp) => {
        const deptMatch = reportDept === "ALL" || emp.department === reportDept;
        const ccMatch = reportCC === "ALL" || emp.costCenter === reportCC;

        const subCenterMatch =
          selectedSubCenter === "All" ||
          String(emp.subCenter).toLowerCase().trim() === String(selectedSubCenter).toLowerCase().trim();

        const subItemMatch =
          selectedSubItem === "All" ||
          String(emp.subItem).toLowerCase().trim() === String(selectedSubItem).toLowerCase().trim();

        return deptMatch && ccMatch && subCenterMatch && subItemMatch;
      })
      .map((emp) => {
        let regularTotal = 0;
        let overtimeTotal = 0;
        
        let rangeOnsite = false;
        let rangeLate = false;
        let rangeOnTime = false;
        let rangeAbsent = false;

        const currentStaffCodeClean = String(emp.staffCode).trim().toLowerCase();
        let totalWeekdaysWithNoSwipes = 0;
        let totalTrackedWeekdays = 0;

        const weeklyDayBreakdowns = targetWeekDays.map((day) => {
          const daySwipes = rawSwipesBuffer.filter((s) => {
            return String(s.id).trim().toLowerCase() === currentStaffCodeClean && String(s.date).trim() === day.dateStr;
          });

          const checkDate = new Date(day.dateStr);
          const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6; 
          const currentDayCap = isWeekend ? 5.5 : 8.5;
          const isFuture = day.dateStr > todayStr;

          if (!isWeekend && !isFuture) {
            totalTrackedWeekdays++;
          }

          if (daySwipes.length === 0) {
            if (!isWeekend && !isFuture) {
              totalWeekdaysWithNoSwipes++;
            }
            return {
              dateStr: day.dateStr,
              clockIn: "—",
              clockOut: "—",
              regularHours: 0,
              overtimeHours: 0,
              label: "0.0 / 0.0"
            };
          }

          rangeOnsite = true;

          if (daySwipes.length === 1) {
            regularTotal += currentDayCap;
            rangeLate = true; 
            return {
              dateStr: day.dateStr,
              clockIn: daySwipes[0].time,
              clockOut: "MISSING",
              regularHours: currentDayCap,
              overtimeHours: 0,
              label: `${currentDayCap.toFixed(1)} / 0.0`
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

          if (ins.length === 0 || outs.length === 0) {
            const sortedFallback = [...daySwipes].sort((a, b) => String(a.time).localeCompare(String(b.time)));
            if (sortedFallback.length >= 2) {
              ins.push(sortedFallback[0]);
              outs.push(sortedFallback[sortedFallback.length - 1]);
            } else {
              regularTotal += currentDayCap;
              rangeLate = true;
              return {
                dateStr: day.dateStr,
                clockIn: sortedFallback[0].time,
                clockOut: "MISSING",
                regularHours: currentDayCap,
                overtimeHours: 0,
                label: `${currentDayCap.toFixed(1)} / 0.0`
              };
            }
          }

          const firstInTime = ins[0].time;
          const lastOutTime = outs[outs.length - 1].time;

          if (firstInTime) {
            const [inH, inM] = firstInTime.split(":").map(Number);
            if (!isNaN(inH)) {
              if (inH > 7 || (inH === 7 && inM > 30)) {
                rangeLate = true;
              } else {
                rangeOnTime = true;
              }
            } else {
              rangeLate = true;
            }
          }

          const [inH, inM] = firstInTime.split(":").map(Number);
          const [outH, outM] = lastOutTime.split(":").map(Number);

          if (isNaN(inH) || isNaN(outH)) {
            regularTotal += currentDayCap;
            return {
              dateStr: day.dateStr,
              clockIn: firstInTime,
              clockOut: lastOutTime,
              regularHours: currentDayCap,
              overtimeHours: 0,
              label: `${currentDayCap.toFixed(1)} / 0.0`
            };
          }

          const rawTotalHours = (outH * 60 + outM - (inH * 60 + inM)) / 60;
          const totalHoursAfterLunch = Math.max(0, rawTotalHours - 1); 

          let worked = totalHoursAfterLunch > currentDayCap ? currentDayCap : totalHoursAfterLunch;
          let ot = totalHoursAfterLunch > currentDayCap ? totalHoursAfterLunch - currentDayCap : 0;

          regularTotal += worked;
          overtimeTotal += ot;

          return {
            dateStr: day.dateStr,
            clockIn: firstInTime,
            clockOut: lastOutTime,
            regularHours: worked,
            overtimeHours: ot,
            label: `${worked.toFixed(1)} / ${ot.toFixed(1)}`
          };
        });

        if (totalTrackedWeekdays > 0 && totalWeekdaysWithNoSwipes === totalTrackedWeekdays) {
          rangeAbsent = true;
        }

        return {
          ...emp,
          weeklyDayBreakdowns,
          rangeDateFlags: {
            onsite: rangeOnsite,
            late: rangeLate,
            onTime: rangeOnTime,
            absent: rangeAbsent
          },
          metricsSummary: {
            regularTotal,
            overtimeTotal,
            combinedTotal: regularTotal + overtimeTotal
          },
          grandTotalLabel: `${regularTotal.toFixed(1)} / ${overtimeTotal.toFixed(1)}`
        };
      });
  }, [employeeDirectory, rawSwipesBuffer, targetWeekDays, reportDept, reportCC, selectedSubCenter, selectedSubItem]);

  const liveMetricsRollup = useMemo(() => {
    let onsite = 0;
    let absent = 0;
    let onTime = 0;
    let late = 0;

    fullyCalculatedDataset.forEach((row) => {
      if (row.rangeDateFlags.onsite) onsite++;
      if (row.rangeDateFlags.absent) absent++;
      if (row.rangeDateFlags.onTime) onTime++;
      if (row.rangeDateFlags.late) late++;
    });

    return { onsite, absent, onTime, late };
  }, [fullyCalculatedDataset]);

  const filteredViewDataset = useMemo(() => {
    return fullyCalculatedDataset.filter((row) => {
      if (selectedMetricFilter === "ONSITE") return row.rangeDateFlags.onsite;
      if (selectedMetricFilter === "ABSENT") return row.rangeDateFlags.absent;
      if (selectedMetricFilter === "ON_TIME") return row.rangeDateFlags.onTime;
      if (selectedMetricFilter === "LATE") return row.rangeDateFlags.late;
      return true;
    });
  }, [fullyCalculatedDataset, selectedMetricFilter]);

  const handleDownloadReport = async () => {
    if (!filteredViewDataset || filteredViewDataset.length === 0) {
      alert("No active timesheet data available to export.");
      return;
    }
    setIsDownloadingPdf(true);
    
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      
      try {
        const logoBase64 = await getBase64ImageFromUrl("/gofresh_logo.jpg");
        // params: imageSrc, format, x, y, width, height
        doc.addImage(logoBase64, "JPEG", 12, 10, 32, 14);
      } catch (imgErr) {
        console.error("Logo could not be loaded into the PDF", imgErr);
        doc.setTextColor(30, 41, 59).setFont("helvetica", "bold").setFontSize(22).text("Go", 12, 22);
        doc.setTextColor(21, 128, 61).text("Fresh", 23, 22);
      }

      doc.setTextColor(148, 163, 184).setFontSize(7.5).setFont("helvetica", "bold").text("OPERATIONAL TIMESHEET ARCHIVE", 12, 31);
      doc.setTextColor(21, 128, 61).setFontSize(11).text("FILTERED RANGE REPORT", 285, 15, { align: "right" });

      doc.setTextColor(71, 85, 105).setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Department Context: ${reportDept}`, 285, 20, { align: "right" });
      doc.text(`Cost Centre Context: ${reportCC}`, 285, 24, { align: "right" });
      doc.text(`Horizon: ${fromDate} to ${toDate}`, 285, 28, { align: "right" });

      doc.setDrawColor(226, 232, 240).setLineWidth(0.5).line(12, 34, 285, 34);

      const tableHeaders = ["Staff Code", "Full Name", "Sub Center", "Sub Item"];
      targetWeekDays.forEach((day) => tableHeaders.push(`${day.dayName} (${day.dateStr.slice(5)})`));
      tableHeaders.push("Total (Reg/OT)");

      const tableBody = filteredViewDataset.map((row) => {
        const cells = [
          row.staffCode.toUpperCase(),
          row.fullName.toUpperCase(),
          row.subCenter ? row.subCenter.toUpperCase() : "—",
          row.subItem ? row.subItem.toUpperCase() : "—",
        ];
        row.weeklyDayBreakdowns.forEach((d) => cells.push(d.label));
        cells.push(row.grandTotalLabel);
        return cells;
      });

      autoTable(doc, {
        startY: 38,
        margin: { left: 12, right: 12 },
        head: [tableHeaders],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", halign: "center" },
        styles: { fontSize: 7.5, cellPadding: 2.5, halign: "center", valign: "middle" },
      });

      doc.save(`GoFresh_Weekly_Timesheet_${reportDept.replace(/\s+/g, "_")}_${fromDate}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadAllDepartmentsReport = async () => {
    if (!employeeDirectory || employeeDirectory.length === 0) {
      alert("No master employee directory available to export.");
      return;
    }
    setIsDownloadingAllPdf(true);

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      try {
        const logoBase64 = await getBase64ImageFromUrl("/gofresh_logo.jpg");
        doc.addImage(logoBase64, "JPEG", 12, 10, 32, 14);
      } catch (imgErr) {
        console.error("Logo could not be loaded into the Master PDF", imgErr);
        doc.setTextColor(30, 41, 59).setFont("helvetica", "bold").setFontSize(22).text("Go", 12, 22);
        doc.setTextColor(21, 128, 61).text("Fresh", 23, 22);
      }

      doc.setTextColor(148, 163, 184).setFontSize(7.5).setFont("helvetica", "bold").text("MASTER TIMESHEET ARCHIVE", 12, 31);
      doc.setTextColor(21, 128, 61).setFontSize(11).text("MASTER OVERVIEW SUMMARY", 285, 15, { align: "right" });

      doc.setTextColor(71, 85, 105).setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Comprehensive View Scope: All Departments & Cost Centers`, 285, 21, { align: "right" });
      doc.text(`Horizon Range Framework: ${fromDate} to ${toDate}`, 285, 26, { align: "right" });

      doc.setDrawColor(226, 232, 240).setLineWidth(0.5).line(12, 34, 285, 34);

      const tableHeaders = ["Code", "Full Name", "Department", "Cost Center", "Sub Center"];
      targetWeekDays.forEach((day) => tableHeaders.push(`${day.dayName} (${day.dateStr.slice(5)})`));
      tableHeaders.push("Total Hours");

      const allCalculated = employeeDirectory
        .map((emp) => {
          let regularTotal = 0;
          let overtimeTotal = 0;
          const currentStaffCodeClean = String(emp.staffCode).trim().toLowerCase();

          const weeklyDayBreakdowns = targetWeekDays.map((day) => {
            const daySwipes = rawSwipesBuffer.filter((s) => {
              return String(s.id).trim().toLowerCase() === currentStaffCodeClean && String(s.date).trim() === day.dateStr;
            });
            const checkDate = new Date(day.dateStr);
            const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6; 
            const currentDayCap = isWeekend ? 5.5 : 8.5;

            if (daySwipes.length === 0) return { label: "0.0 / 0.0" };
            if (daySwipes.length === 1) {
              regularTotal += currentDayCap;
              return { label: `${currentDayCap.toFixed(1)} / 0.0` };
            }

            const ins = daySwipes.filter((s) => String(s.type).toUpperCase().includes("IN")).sort((a, b) => String(a.time).localeCompare(String(b.time)));
            const outs = daySwipes.filter((s) => String(s.type).toUpperCase().includes("OUT")).sort((a, b) => String(a.time).localeCompare(String(b.time)));

            if (ins.length === 0 || outs.length === 0) {
              regularTotal += currentDayCap;
              return { label: `${currentDayCap.toFixed(1)} / 0.0` };
            }

            const [inH, inM] = ins[0].time.split(":").map(Number);
            const [outH, outM] = outs[outs.length - 1].time.split(":").map(Number);
            
            if (isNaN(inH) || isNaN(outH)) {
              regularTotal += currentDayCap;
              return { label: `${currentDayCap.toFixed(1)} / 0.0` };
            }

            const rawTotalHours = (outH * 60 + outM - (inH * 60 + inM)) / 60;
            const totalHoursAfterLunch = Math.max(0, rawTotalHours - 1); 

            let worked = totalHoursAfterLunch > currentDayCap ? currentDayCap : totalHoursAfterLunch;
            let ot = totalHoursAfterLunch > currentDayCap ? totalHoursAfterLunch - currentDayCap : 0;

            regularTotal += worked;
            overtimeTotal += ot;
            return { label: `${worked.toFixed(1)} / ${ot.toFixed(1)}` };
          });

          return {
            ...emp,
            weeklyDayBreakdowns,
            grandTotalLabel: `${regularTotal.toFixed(1)} / ${overtimeTotal.toFixed(1)}`
          };
        })
        .sort((a, b) => a.department.localeCompare(b.department) || a.fullName.localeCompare(b.fullName));

      const tableBody = allCalculated.map((row) => {
        const cells = [
          row.staffCode.toUpperCase(),
          row.fullName.toUpperCase(),
          row.department.toUpperCase(),
          row.costCenter.toUpperCase(),
          row.subCenter ? row.subCenter.toUpperCase() : "—",
        ];
        row.weeklyDayBreakdowns.forEach((d) => cells.push(d.label));
        cells.push(row.grandTotalLabel);
        return cells;
      });

      autoTable(doc, {
        startY: 38,
        margin: { left: 12, right: 12 },
        head: [tableHeaders],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", halign: "center" },
        styles: { fontSize: 6.5, cellPadding: 2, halign: "center", valign: "middle" },
      });

      doc.save(`GoFresh_Master_Timesheet_ALL_${fromDate}.pdf`);
    } catch (err) {
      console.error("Master Export Failed:", err);
    } finally {
      setIsDownloadingAllPdf(false);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen p-6 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                Workforce Attendance Analytics Dashboard
              </h2>
              <p className="text-xs text-slate-400 font-medium uppercase">
                Grid metrics and active filters respond exclusively to the selected start and end log dates.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs shrink-0">
              <div className="flex items-center gap-1.5 border-r pr-3">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <label htmlFor="from-date-filter" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Logs Start:
                </label>
                <Input
                  id="from-date-filter"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-7 text-xs font-bold border-none shadow-none focus-visible:ring-0 w-[115px] p-0 text-slate-800 bg-transparent uppercase"
                />
              </div>

              <div className="flex items-center gap-1.5 pl-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <label htmlFor="to-date-filter" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Logs End:
                </label>
                <Input
                  id="to-date-filter"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-7 text-xs font-bold border-none shadow-none focus-visible:ring-0 w-[115px] p-0 text-slate-800 bg-transparent uppercase"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              onClick={() => setSelectedMetricFilter(selectedMetricFilter === "ONSITE" ? "ALL" : "ONSITE")}
              className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-blue-600 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                selectedMetricFilter === "ONSITE" ? "ring-2 ring-blue-500 bg-blue-50/10" : ""
              }`}
            >
              <CardHeader className="p-4">
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" /> Onsite
                </CardDescription>
                <CardTitle className="text-xl font-black text-slate-900 mt-1 flex justify-between items-center">
                  <span>{liveMetricsRollup.onsite} Checked In</span>
                  {selectedMetricFilter === "ONSITE" && <Badge className="bg-blue-600 text-[9px]">FILTER ACTIVE</Badge>}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card
              onClick={() => setSelectedMetricFilter(selectedMetricFilter === "ABSENT" ? "ALL" : "ABSENT")}
              className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-amber-500 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                selectedMetricFilter === "ABSENT" ? "ring-2 ring-amber-500 bg-amber-50/10" : ""
              }`}
            >
              <CardHeader className="p-4">
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Absent / Incomplete
                </CardDescription>
                <CardTitle className="text-xl font-black text-slate-900 mt-1 flex justify-between items-center">
                  <span>{liveMetricsRollup.absent} Workers</span>
                  {selectedMetricFilter === "ABSENT" && <Badge className="bg-amber-500 text-[9px]">FILTER ACTIVE</Badge>}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card
              onClick={() => setSelectedMetricFilter(selectedMetricFilter === "ON_TIME" ? "ALL" : "ON_TIME")}
              className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-emerald-500 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                selectedMetricFilter === "ON_TIME" ? "ring-2 ring-emerald-500 bg-emerald-50/10" : ""
              }`}
            >
              <CardHeader className="p-4">
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> On Time (&le; 07:30 AM)
                </CardDescription>
                <CardTitle className="text-xl font-black text-slate-900 mt-1 flex justify-between items-center">
                  <span>{liveMetricsRollup.onTime} Workers</span>
                  {selectedMetricFilter === "ON_TIME" && <Badge className="bg-emerald-600 text-[9px]">FILTER ACTIVE</Badge>}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card
              onClick={() => setSelectedMetricFilter(selectedMetricFilter === "LATE" ? "ALL" : "LATE")}
              className={`bg-white border border-slate-200 rounded-xl border-l-4 border-l-rose-500 shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
                selectedMetricFilter === "LATE" ? "ring-2 ring-rose-500 bg-rose-50/10" : ""
              }`}
            >
              <CardHeader className="p-4">
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-500" /> Late Arrivals (&gt; 07:30 AM)
                </CardDescription>
                <CardTitle className="text-xl font-black text-rose-600 mt-1 flex justify-between items-center">
                  <span>{liveMetricsRollup.late} Workers</span>
                  {selectedMetricFilter === "LATE" && <Badge className="bg-rose-600 text-[9px]">FILTER ACTIVE</Badge>}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                Department Filter:
              </label>
              <select
                value={reportDept}
                onChange={(e) => setReportDept(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs focus:outline-none min-w-[160px] uppercase"
              >
                <option value="ALL">ALL DEPARTMENTS</option>
                {Array.from(new Set(employeeDirectory.map((e) => e.department)))
                  .filter(Boolean)
                  .map((dept) => (
                    <option key={dept} value={dept}>{dept.toUpperCase()}</option>
                  ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                Cost Center Context:
              </label>
              <select
                value={reportCC}
                onChange={(e) => setReportCC(e.target.value)}
                disabled={reportDept === "ALL"}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs focus:outline-none min-w-[160px] uppercase disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="ALL">ALL COST CENTERS</option>
                {distinctCostCenters.map((cc) => (
                  <option key={cc} value={cc}>{cc.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5">
                Sub Center Lookup:
              </label>
              <select
                value={selectedSubCenter}
                onChange={(e) => setSelectedSubCenter(e.target.value)}
                disabled={reportCC === "ALL"}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs focus:outline-none min-w-[160px] uppercase disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="All">ALL SUB CENTERS</option>
                {reportCC !== "ALL" ? (
                  distinctSubCenters.map((sc) => (
                    <option key={sc} value={sc}>{sc.toUpperCase()}</option>
                  ))
                ) : (
                  subCentersList.filter(s => s !== "All").map((sc) => (
                    <option key={sc} value={sc}>{sc.toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-400 pl-0.5 flex items-center gap-1">
                <Layers className="w-3 h-3 text-green-700" /> Sub-Item Production:
              </label>
              <select
                value={selectedSubItem}
                onChange={(e) => setSelectedSubItem(e.target.value)}
                disabled={reportCC === "ALL" || !isSubItemApplicable(selectedSubCenter)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs focus:outline-none min-w-[160px] uppercase disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="All">ALL SUB ITEMS</option>
                {reportCC !== "ALL" ? (
                  distinctSubItems.map((si) => (
                    <option key={si} value={si}>{si.toUpperCase()}</option>
                  ))
                ) : (
                  subItemsList.filter(s => s !== "All").map((si) => (
                    <option key={si} value={si}>{si.toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center gap-2 shadow-xs border p-1 rounded-lg bg-slate-50 ml-auto sm:ml-0">
              <Button 
                size="sm" 
                onClick={handleDownloadAllDepartmentsReport} 
                disabled={isDownloadingAllPdf || employeeDirectory.length === 0} 
                className="h-8 text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-1"
              >
                {isDownloadingAllPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span>Master Report</span>
              </Button>

              <Button 
                size="sm" 
                onClick={handleDownloadReport} 
                disabled={isDownloadingPdf || filteredViewDataset.length === 0} 
                className="h-8 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
              >
                {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Filtered Report</span>
              </Button>
            </div>

            <div className="ml-auto text-xs text-slate-500 font-semibold uppercase hidden lg:block">
              Filter: <Badge ballroom-variant="outline" className="font-mono bg-slate-100 text-slate-700">{selectedMetricFilter}</Badge>
            </div>
          </div>

          <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {isLoadingEmployees || isLoadingAttendance ? (
              <div className="flex flex-col items-center justify-center p-16 space-y-2 text-slate-400 font-medium">
                <Loader2 className="w-8 h-8 animate-spin text-green-700" />
                <span className="text-xs uppercase tracking-wider animate-pulse">Recalculating contextual workforce timesheets...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 tracking-wider uppercase">
                      <th className="p-3 w-48 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Staff Member / Type</th>
                      {targetWeekDays.map((day) => (
                        <th key={day.dateStr} className="p-3 text-center border-l border-slate-200">
                          {day.dayName}
                          <span className="block text-[8px] text-slate-400 font-medium normal-case mt-0.5">{day.dateStr}</span>
                        </th>
                      ))}
                      <th className="p-3 text-center border-l-2 border-slate-300 bg-slate-100/70">Reg Total</th>
                      <th className="p-3 text-center border-l border-slate-200 bg-slate-100/70">OT Total</th>
                      <th className="p-3 text-center border-l-2 border-slate-300 bg-blue-50/50 text-blue-700">Combined Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-700">
                    {filteredViewDataset.length > 0 ? (
                      filteredViewDataset.map((emp) => (
                        <tr key={emp.staffCode} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-semibold sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div className="font-bold text-slate-900 uppercase truncate max-w-[180px]">{emp.fullName}</div>
                            <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between mt-0.5">
                              <span>{emp.staffCode}</span>
                              <Badge className="text-[7px] px-1 py-0 h-3.5 tracking-tighter" variant={emp.rangeDateFlags.onsite ? "secondary" : "destructive"}>
                                {emp.rangeDateFlags.onsite ? "ONSITE" : "ABSENT"}
                              </Badge>
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-1 py-0.5 rounded w-max">Regular (8.5h Cap)</div>
                              <div className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1 py-0.5 rounded w-max">Overtime (OT)</div>
                            </div>
                          </td>

                          {emp.weeklyDayBreakdowns.map((day) => (
                            <td key={day.dateStr} className="p-3 text-center border-l border-slate-200 align-top">
                              <div className="text-[10px] text-slate-400 font-mono font-medium">
                                {day.clockIn} &rarr; {day.clockOut}
                              </div>
                              <div className="mt-2 space-y-1 font-mono font-bold text-xs">
                                <div className={day.regularHours > 0 ? "text-slate-900" : "text-slate-300"}>
                                  {day.regularHours.toFixed(1)}h
                                </div>
                                <div className={day.overtimeHours > 0 ? "text-amber-600 bg-amber-50/50 rounded" : "text-slate-300"}>
                                  {day.overtimeHours > 0 ? `+${day.overtimeHours.toFixed(1)}h` : "0.0h"}
                                </div>
                              </div>
                            </td>
                          ))}

                          <td className="p-3 text-center border-l-2 border-slate-300 font-mono font-black text-slate-900 bg-slate-100/30">
                            <div className="h-4" />
                            <div className="mt-1">{emp.metricsSummary.regularTotal.toFixed(2)}h</div>
                          </td>
                          <td className="p-3 text-center border-l border-slate-200 font-mono font-black text-amber-600 bg-slate-100/30">
                            <div className="h-4" />
                            <div className="mt-1">+{emp.metricsSummary.overtimeTotal.toFixed(2)}h</div>
                          </td>
                          <td className="p-3 text-center border-l-2 border-slate-300 font-mono font-black text-blue-700 bg-blue-50/30">
                            <div className="h-4" />
                            <div className="mt-1 text-sm">{emp.metricsSummary.combinedTotal.toFixed(2)}h</div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={ targetWeekDays.length + 4 } className="text-center p-8 text-slate-400 font-semibold italic uppercase">
                          No tracking entries match the requested metric filter combinations.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}