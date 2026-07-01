"use client";
import { useState, useMemo, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileSpreadsheet,
  FileText,
  LogOut,
  Terminal,
  Activity,
  RefreshCw,
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
  name: string;
  date: string; // ISO format "2026-05-26"
  weekDay: string; 
  time: string; 
  type: string; 
}

interface SessionUser {
  id: string;
  email: string;
  role: "superuser" | "manager" | "operator";
}

interface DailyRecord {
  display: string;
  hours: number;
  ot: number;
}

export default function AttendanceReportPage() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([]);
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[INFO] Calendar Highlighting Engine ready. Standing by for pipeline execution...",
  ]);

  const addLog = (msg: string) => {
    setSystemLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`].slice(-4));
  };

  const timeStringToDecimal = (timeStr: string): number => {
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs + (mins / 60);
  };

  const formatPresentationDate = (isoString: string): string => {
    if (!isoString) return "";
    const parts = isoString.split("-");
    if (parts.length !== 3) return isoString;
    
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    
    return `${day} - ${monthNames[monthIndex] || parts[1]} - ${year}`;
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
          const records = Array.isArray(empData) ? empData : empData.employees || [];
          setEmployeeDirectory(records);
        }
      } catch (err) {
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    }
    initializeDashboard();
  }, [router]);

  const syncAllSavedAttendanceData = async () => {
    if (!user || isFetchingData) return;
    setIsFetchingData(true);
    try {
      addLog(`[API_SYNC] Initializing continuous table assembly sequence...`);

      let masterBufferArray: RawSwipe[] = [];
      let currentPage = 0;
      let keepStreaming = true;
      const batchChunkSize = 2500;

      while (keepStreaming) {
        addLog(`[API_SYNC] Downloading biometric block sequence index: ${currentPage + 1}...`);

        const response = await fetch(`/api/attendance?page=${currentPage}&size=${batchChunkSize}`);
        if (!response.ok) throw new Error(`Data pipeline broke at sector chunk ${currentPage}`);

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
      addLog(`[SUCCESS] Aggregation complete! Compiled ${masterBufferArray.length} transaction entries.`);
    } catch (err: any) {
      addLog(`[ERROR] Continuous stream exception: ${err.message}`);
    } finally {
      setIsFetchingData(false);
    }
  };

  useEffect(() => {
    if (user) syncAllSavedAttendanceData();
  }, [user]);

  const targetTimelineDates = useMemo(() => {
    let uniquelyDiscoveredIsoDates = Array.from(new Set(rawSwipesBuffer.map((s) => s.date))).sort();
    
    if (startDate) {
      uniquelyDiscoveredIsoDates = uniquelyDiscoveredIsoDates.filter(d => d >= startDate);
    }
    if (endDate) {
      uniquelyDiscoveredIsoDates = uniquelyDiscoveredIsoDates.filter(d => d <= endDate);
    }

    return uniquelyDiscoveredIsoDates.map((dateStr) => {
      const matchSample = rawSwipesBuffer.find((s) => s.date === dateStr);
      const dayOfWeekString = matchSample?.weekDay || "";
      const isSunday = dayOfWeekString.toLowerCase() === "sunday";
      
      return {
        iso: dateStr,
        label: formatPresentationDate(dateStr),
        isSunday: isSunday,
        weekDay: dayOfWeekString
      };
    });
  }, [rawSwipesBuffer, startDate, endDate]);

  const gridCompiledDataset = useMemo(() => {
    const distinctSwipedIds = new Set(rawSwipesBuffer.map(s => s.id));
    
    const baseEmployees = employeeDirectory.map(emp => ({
      code: emp.staffCode,
      name: emp.fullName,
      department: emp.department || "General Operations",
    }));

    distinctSwipedIds.forEach(id => {
      if (!baseEmployees.some(e => e.code === id)) {
        const fallbackName = rawSwipesBuffer.find(s => s.id === id)?.name || "Unknown Staff";
        baseEmployees.push({ code: id, name: fallbackName, department: "Unassigned Sector" });
      }
    });

    return baseEmployees.map((emp) => {
      const dailyMap: Record<string, DailyRecord> = {};
      
      let od = 0; let np = 0; let sl = 0; let ph = 0; let al = 0;
      let totalHours = 0; let np_h = 0; let count_n = 0; let count_t = 0; let t_rec = 0; 
      let ph1 = 0; let ph2 = 0; let ph3 = 0; let ph4 = 0; let ph_n = 0; let ph_d = 0; let off_day_p = 0;
      let std_hr = 0; let act_h_pr = 0; let n_ot = 0; let dot = 0; let ph_hours = 0; let ab_hr = 0; 

      targetTimelineDates.forEach((dateObj) => {
        const matches = rawSwipesBuffer.filter((s) => s.id === emp.code && s.date === dateObj.iso);
        const isWeekend = dateObj.weekDay === "Saturday" || dateObj.weekDay === "Sunday";
        const maxStandardThreshold = isWeekend ? 5.5 : 8.5;

        // Condition 1: Completely empty dataset for the day -> Mark as Off Day (OD)
        if (matches.length === 0) {
          dailyMap[dateObj.iso] = { display: "0", hours: 0, ot: 0 };
          od++;
          return;
        }

        t_rec++;
        count_t += matches.length;

        const hasSL = matches.some(m => m.type.toUpperCase() === "SL");
        const hasNP = matches.some(m => m.type.toUpperCase() === "NP");
        const hasPH = matches.some(m => m.type.toUpperCase() === "PH");
        const hasAL = matches.some(m => m.type.toUpperCase() === "AL");

        if (hasSL) { dailyMap[dateObj.iso] = { display: "SL", hours: 0, ot: 0 }; sl++; return; }
        if (hasNP) { dailyMap[dateObj.iso] = { display: "NP", hours: 0, ot: 0 }; np++; ab_hr += maxStandardThreshold; return; }
        if (hasPH) { dailyMap[dateObj.iso] = { display: "PH", hours: 0, ot: 0 }; ph++; ph_hours += maxStandardThreshold; return; }
        if (hasAL) { dailyMap[dateObj.iso] = { display: "AL", hours: 0, ot: 0 }; al++; return; }

        const checkIns = matches.filter(m => m.type.toLowerCase().includes("in")).sort((a, b) => a.time.localeCompare(b.time));
        const checkOuts = matches.filter(m => m.type.toLowerCase().includes("out")).sort((a, b) => b.time.localeCompare(a.time));

        // Condition 2: Check-In exists but missing Check-Out -> Award standard daily allocation hours
        if (checkIns.length > 0 && checkOuts.length === 0) {
          totalHours += maxStandardThreshold;
          std_hr += maxStandardThreshold;
          dailyMap[dateObj.iso] = { 
            display: `${maxStandardThreshold.toFixed(1)}`, 
            hours: maxStandardThreshold, 
            ot: 0 
          };
          return;
        }

        // Condition 3: Incomplete Punch (Missing In OR Out) -> Default to "0" and add to Absence Hours
        if (checkIns.length === 0 || checkOuts.length === 0) {
          dailyMap[dateObj.iso] = { display: "0", hours: 0, ot: 0 };
          ab_hr += maxStandardThreshold; 
          return;
        }

        // Dynamic standard duration math using dynamic check-in points
        const firstInDecimal = timeStringToDecimal(checkIns[0].time);
        const lastOutDecimal = timeStringToDecimal(checkOuts[0].time);
        const standardCheckOutTime = isWeekend ? timeStringToDecimal("13:00") : timeStringToDecimal("17:00");

        let dailyStd = (standardCheckOutTime - firstInDecimal) - 1.0;
        if (dailyStd < 0) dailyStd = 0;

        if (dailyStd > maxStandardThreshold) {
          dailyStd = maxStandardThreshold;
        }

        let dailyOt = 0;
        if (lastOutDecimal > standardCheckOutTime) {
          dailyOt = lastOutDecimal - standardCheckOutTime;
        }

        const calculatedNetDuration = dailyStd + dailyOt;

        totalHours += calculatedNetDuration;
        std_hr += dailyStd;

        if (isWeekend) {
          dot += dailyOt; 
        } else {
          n_ot += dailyOt; 
        }

        const displayLabel = dailyOt > 0 
          ? `${dailyStd.toFixed(1)} + ${dailyOt.toFixed(1)}` 
          : `${dailyStd.toFixed(1)}`;

        dailyMap[dateObj.iso] = { display: displayLabel, hours: calculatedNetDuration, ot: dailyOt };
      });

      act_h_pr = std_hr + n_ot + (dot * 2);

      return {
        employee_id_string: `${emp.code} - ${emp.name}`,
        department: emp.department,
        date_records: dailyMap,
        od, np, sl, ph, al,
        totalHours, np_h, count_n, count_t, t_rec,
        ph1, ph2, ph3, ph4, ph_n, ph_d, off_day_p,
        std_hr, act_h_pr, n_ot, dot, ph_hours, ab_hr
      };
    });
  }, [employeeDirectory, rawSwipesBuffer, targetTimelineDates]);

  const filteredReportDataset = useMemo(() => {
    return gridCompiledDataset.filter((row) => {
      const matchSearch = row.employee_id_string.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = selectedDepartment ? row.department === selectedDepartment : true;
      return matchSearch && matchDept;
    });
  }, [gridCompiledDataset, searchQuery, selectedDepartment]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    employeeDirectory.forEach(e => { if (e.department) depts.add(e.department); });
    return Array.from(depts).sort();
  }, [employeeDirectory]);

  const summaryFields = [
    "OD", "NP", "SL", "PH", "AL", "Total Hours", "NP H", "Count N", "Count T", "T Rec",
    "PH1", "PH2", "PH3", "PH4", "PH N", "PH D", "OFF Day P", "STD HR", "Act H PR", "N OT", "DOT", "PH_Hours", "AB HR"
  ];

  const exportToExcelFormat = () => {
    addLog("[EXPORT] Assembling expanded matrix sheet for workbook dispatch...");
    const headers = ["Attendance Rec.", "Department", ...targetTimelineDates.map(d => d.label), ...summaryFields];

    const dataRows = filteredReportDataset.map((row) => [
      row.employee_id_string,
      row.department,
      ...targetTimelineDates.map((d) => row.date_records[d.iso]?.display ?? ""),
      row.od, row.np, row.sl, row.ph, row.al,
      row.totalHours.toFixed(1), row.np_h, row.count_n, row.count_t, row.t_rec,
      row.ph1, row.ph2, row.ph3, row.ph4, row.ph_n, row.ph_d, row.off_day_p,
      row.std_hr.toFixed(1), row.act_h_pr.toFixed(1), row.n_ot.toFixed(1), row.dot.toFixed(1), row.ph_hours.toFixed(1), row.ab_hr.toFixed(1)
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reconciliation Summary");
    
    XLSX.writeFile(workbook, "Extended_Attendance_Overall_Report.xlsx");
    addLog("[SUCCESS] Download complete.");
  };

  const exportToPDFFormat = () => {
    addLog("[EXPORT] Running dynamic vectors layout mappings for landscape PDF...");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a2" });

    doc.setFontSize(16);
    doc.text("GOFRESH WORKFORCE MANAGEMENT SYSTEM - FULL ATTENDANCE SUMMARY PROFILE", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Active Count: ${filteredReportDataset.length} rows`, 14, 22);

    const headers = [
      "Employee Profile",
      "Department",
      ...targetTimelineDates.map(d => d.label),
      ...summaryFields
    ];

    const tableRows = filteredReportDataset.map((row) => [
      row.employee_id_string,
      row.department,
      ...targetTimelineDates.map((d) => String(row.date_records[d.iso]?.display ?? "")),
      row.od, row.np, row.sl, row.ph, row.al,
      row.totalHours.toFixed(1), row.np_h, row.count_n, row.count_t, row.t_rec,
      row.ph1, row.ph2, row.ph3, row.ph4, row.ph_n, row.ph_d, row.off_day_p,
      row.std_hr.toFixed(1), row.act_h_pr.toFixed(1), row.n_ot.toFixed(1), row.dot.toFixed(1), row.ph_hours.toFixed(1), row.ab_hr.toFixed(1)
    ]);

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: tableRows,
      theme: "grid",
      styles: { fontSize: 5.5, cellPadding: 0.6, font: "courier", halign: "center" },
      columnStyles: { 
        0: { halign: "left", cellWidth: 35 },
        1: { halign: "left", cellWidth: 25 }
      },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
    });

    doc.save("Extended_Workforce_Attendance_Report.pdf");
    addLog("[SUCCESS] PDF report saved.");
  };

  if (isLoading) {
    return (
      <div className="flex bg-slate-950 text-slate-100 min-h-screen items-center justify-center font-mono text-xs uppercase tracking-widest">
        <Activity className="w-4 h-4 animate-spin text-blue-500 mr-2" /> Instantiating Highlighting Context Matrix...
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 text-slate-900 min-h-screen antialiased">
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between fixed h-full top-0 left-0 z-30 shadow-xl border-r border-slate-800">
        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          <div className="py-3 px-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-black text-xs shadow-md">GF</div>
              <div>
                <span className="font-black text-xs tracking-wider uppercase block text-slate-100">GoFresh Engine</span>
                <span className="text-[9px] font-bold text-slate-500 tracking-widest block">EXTENDED_MATRIX</span>
              </div>
            </div>
            <Button onClick={() => router.push("/")} variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-4 pt-2">
            <span className="text-[10px] font-black text-slate-500 tracking-widest block px-3">PIPELINE ENGINE</span>
            <Button 
              onClick={syncAllSavedAttendanceData} 
              disabled={isFetchingData}
              variant="outline" 
              className="w-full justify-start gap-3 px-3 py-2.5 text-white bg-slate-950 border-slate-800 hover:bg-slate-800 text-xs font-bold"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${isFetchingData ? "animate-spin" : ""}`} />
              <span>{isFetchingData ? "SYNCING TABLES..." : "RE-RUN BACKEND SYNC"}</span>
            </Button>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            <span className="text-[10px] font-black text-slate-500 tracking-widest block px-3">FILTER DEPARTMENT</span>
            <div className="px-1">
              <select 
                value={selectedDepartment || "ALL"} 
                onChange={(e) => setSelectedDepartment(e.target.value === "ALL" ? null : e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] font-bold rounded p-2.5 uppercase tracking-wide"
              >
                <option value="ALL">ALL DEPARTMENTS</option>
                {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            <span className="text-[10px] font-black text-slate-500 tracking-widest block px-3">TIMELINE LIMITER</span>
            <div className="px-1 space-y-2">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] rounded p-2 text-center font-mono uppercase tracking-wide outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">End Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] rounded p-2 text-center font-mono uppercase tracking-wide outline-none focus:border-blue-500"
                />
              </div>
              {(startDate || endDate) && (
                <Button 
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                  variant="ghost" 
                  className="w-full text-[10px] h-7 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-bold"
                >
                  CLEAR TIMELINE
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 pl-64 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase">
            <span className="text-slate-400">FINANCIAL COMPLIANCE RECONCILIATION</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900">EXTENDED ATTENDANCE OVERVIEW</span>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="SEARCH RECONCILIATION CODES..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-9 text-xs uppercase font-bold rounded-lg h-9 border-slate-200" 
            />
          </div>
        </header>

        <div className="p-8 w-full space-y-6">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  COMPREHENSIVE LABOUR METRICS & PAYROLL RECONCILIATION LAYOUT
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500 mt-1">
                  Full tracking output grid mapped with Sunday highlighting features, dynamic timeline scopes, and extended department fields.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={exportToExcelFormat} 
                  disabled={filteredReportDataset.length === 0}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black tracking-wider gap-2 h-9 rounded-lg px-4"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> EXPORT EXCEL
                </Button>
                <Button 
                  onClick={exportToPDFFormat} 
                  disabled={filteredReportDataset.length === 0}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black tracking-wider gap-2 h-9 rounded-lg px-4"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400" /> DOWNLOAD PDF REPORT
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-max border-collapse">
                  <TableHeader>
                    <TableRow className="bg-slate-900 hover:bg-slate-900 border-b border-slate-800">
                      <TableHead className="text-[10px] font-black text-white bg-slate-950 uppercase p-4 text-left border-r border-slate-800 sticky left-0 z-10 min-w-[240px]">
                        Attendance Rec.
                      </TableHead>
                      <TableHead className="text-[10px] font-black text-cyan-400 bg-slate-950 uppercase p-4 text-left border-r border-slate-800 min-w-[150px]">
                        Department
                      </TableHead>
                      {targetTimelineDates.map((d) => (
                        <TableHead 
                          key={d.iso} 
                          className={`text-[9px] font-black p-2 text-center border-r border-slate-800 min-w-[125px] transition-colors ${
                            d.isSunday 
                              ? "bg-yellow-400 text-slate-950 border-b-2 border-b-amber-500" 
                              : "text-slate-300 bg-slate-900"
                          }`}
                        >
                          {d.label}
                        </TableHead>
                      ))}
                      {summaryFields.map(field => (
                        <TableHead key={field} className="text-[10px] font-black text-cyan-400 bg-slate-950 uppercase p-2 text-center border-r border-slate-800 min-w-[55px]">
                          {field}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReportDataset.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={targetTimelineDates.length + summaryFields.length + 2} className="text-center p-8 font-mono text-xs text-slate-400 uppercase tracking-wider">
                          {isFetchingData ? "Streaming datastore chunks... standby" : "No timesheet rows matching filter context tracked."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReportDataset.map((row) => (
                        <TableRow key={row.employee_id_string} className="border-b border-slate-200 hover:bg-slate-50/80 group">
                          <TableCell className="font-mono text-xs font-bold text-slate-800 bg-white group-hover:bg-slate-50 sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.01)] p-3">
                            <span className="block truncate max-w-[230px] text-left uppercase">{row.employee_id_string}</span>
                          </TableCell>

                          <TableCell className="font-mono text-[11px] font-bold text-slate-500 border-r border-slate-200 p-3 text-left uppercase">
                            {row.department}
                          </TableCell>

                          {targetTimelineDates.map((dateObj) => {
                            const rec = row.date_records[dateObj.iso];
                            const val = rec ? rec.display : "";
                            let styleModifiers = "text-slate-800 font-bold";
                            
                            if (val === "OD") styleModifiers = "text-purple-600 font-black bg-purple-50/40";
                            else if (val === "0") styleModifiers = "text-rose-600 font-black bg-rose-50/40";
                            else if (val === "SL") styleModifiers = "text-amber-600 font-black bg-amber-50/40";
                            else if (val === "PH") styleModifiers = "text-cyan-600 font-black bg-cyan-50/40";
                            else if (val === "AL") styleModifiers = "text-indigo-600 font-black bg-indigo-50/40";
                            else if (rec && rec.ot > 0) styleModifiers = "text-emerald-700 font-black bg-emerald-50/30";

                            if (dateObj.isSunday) {
                              styleModifiers += " bg-yellow-100/70 border-x border-x-yellow-200 text-amber-950";
                            }

                            return (
                              <TableCell key={dateObj.iso} className={`text-center text-xs border-r border-slate-100 p-2 ${styleModifiers}`}>
                                {val || "—"}
                              </TableCell>
                            );
                          })}

                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 bg-slate-50/30 text-purple-700">{row.od}</TableCell>
                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 bg-slate-50/30 text-rose-700">{row.np}</TableCell>
                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 bg-slate-50/30 text-amber-700">{row.sl}</TableCell>
                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 bg-slate-50/30 text-cyan-700">{row.ph}</TableCell>
                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 bg-slate-50/30 text-indigo-700">{row.al}</TableCell>
                          
                          <TableCell className="text-center font-black text-xs border-r border-slate-100 bg-blue-50/40 text-blue-950">{row.totalHours.toFixed(1)}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-500">{row.np_h}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-500">{row.count_n}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-500">{row.count_t}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 font-bold text-slate-700">{row.t_rec}</TableCell>
                          
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-400">{row.ph1}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-400">{row.ph2}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-400">{row.ph3}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-400">{row.ph4}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-400">{row.ph_n}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-400">{row.ph_d}</TableCell>
                          <TableCell className="text-center text-xs border-r border-slate-100 text-slate-400">{row.off_day_p}</TableCell>
                          
                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 text-slate-800">{row.std_hr.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-black text-xs border-r border-slate-100 bg-slate-900 text-white">{row.act_h_pr.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 text-emerald-700">{row.n_ot.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-bold text-xs border-r border-slate-100 text-orange-700">{row.dot.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-medium text-xs border-r border-slate-100 text-cyan-700">{row.ph_hours.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-bold text-xs text-rose-700">{row.ab_hr.toFixed(1)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <footer className="mt-auto p-8 pt-0">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="pb-1.5 pt-3 px-5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-blue-600" /> COMPLIANCE MATRIX LOGGER RUNTIME
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="border border-slate-200 rounded-lg bg-slate-950 p-3 font-mono text-[10px] text-slate-400 space-y-1">
                {systemLogs.map((log, i) => <div key={i} className="truncate">{log}</div>)}
              </div>
            </CardContent>
          </Card>
        </footer>
      </div>
    </div>
  );
}