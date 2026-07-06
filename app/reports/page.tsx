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
import { Download, Building2, Loader2 } from "lucide-react";
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

export default function EMSTimesheetDashboard() {
  // 🏢 EXACT REAL-TIME MAPPING DIRECTLY FROM GOFRESH DOC
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

  // --- STATE PARAMETERS MATCHING DRAWING ---
  const departmentsList = Object.keys(departmentStructure);
  const [selectedDept, setSelectedDept] = useState<string>("Go Fresh Chicken");

  const activeCostCenters = useMemo(() => {
    return departmentStructure[selectedDept] || [];
  }, [selectedDept]);

  const [selectedCC, setSelectedCC] = useState<string>("Chicken Abattoir");

  // Keep selected cost center synced if department changes
  useEffect(() => {
    if (
      activeCostCenters.length > 0 &&
      !activeCostCenters.includes(selectedCC)
    ) {
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

  // --- LIVE BACKEND BUFFERS ---
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>(
    [],
  );
  const [rawSwipesBuffer, setRawSwipesBuffer] = useState<RawSwipe[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(true);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const handleDownloadReport = async () => {
    if (!processedTimesheetData || processedTimesheetData.length === 0) {
      alert("No active timesheet data available to export. Adjust filters.");
      return;
    }

    setIsDownloadingPdf(true);

    const getLogoBase64 = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = "/gofresh_logo.jpg";
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg"));
          } else {
            reject(new Error("Failed to get 2D canvas context"));
          }
        };
        img.onerror = (err) => reject(err);
      });
    };

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      try {
        const logoBase64 = await getLogoBase64();
        doc.addImage(logoBase64, "JPEG", 12, 12, 14, 14);
      } catch (imgError) {
        console.warn(
          "Public image failed to load, applying graceful text branding fallback:",
          imgError,
        );
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Go", 12, 22);
        doc.setTextColor(21, 128, 61);
        doc.text("Fresh", 23, 22);
      }

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

      weekDatesArray.forEach((dateStr) => {
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
        // --- EMERALD HIGHLIGHTING IN ENGINE ---
        didParseCell: (data) => {
          if (data.section !== "body") return;

          const cellValue = String(data.cell.raw || "").trim();
          const isTotalColumn = data.column.index === tableHeaders.length - 1;

          if (isTotalColumn) {
            // Accent highlight style for the terminal grand totals column
            if (cellValue !== "0.0 / 0.0" && cellValue !== "") {
              data.cell.styles.fillColor = [209, 250, 229]; // bg-emerald-100 tint
              data.cell.styles.textColor = [6, 78, 59];    // Deep emerald text
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.fillColor = [248, 250, 252]; // bg-slate-50
              data.cell.styles.textColor = [148, 163, 184]; // text-slate-400
            }
          } else if (data.column.index >= 2) {
            // Style breakdown dates
            if (cellValue !== "0.0 / 0.0" && cellValue !== "") {
              data.cell.styles.textColor = [5, 150, 105];   // text-emerald-600
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 253, 250]; // bg-emerald-50/40 background tint
            } else {
              data.cell.styles.textColor = [148, 163, 184]; // Muted grey for empty logs
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
      console.error("Local Client-side PDF Generation Error Context:", err);
      alert("Could not compile layout matrix PDF locally.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // --- FETCH EMPLOYEES DIRECTORY ---
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

  // --- FETCH ATTENDANCE LOG BUFFER FOR THE SPECIFIED DATE RANGE ---
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

  // --- GENERATE ARRAY OF 7 DATE STRINGS FROM START DATE ---
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

  // --- REAL BIOMETRIC HOURS CALCULATION ENGINE ---
  const processedTimesheetData = useMemo(() => {
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

        const dailyBreakdown = weekDatesArray.map((dateStr) => {
          const daySwipes = rawSwipesBuffer.filter((s) => {
            const matchId =
              String(s.id).trim().toLowerCase() ===
              String(emp.staffCode).trim().toLowerCase();
            const matchDate = String(s.date).trim() === String(dateStr).trim();
            return matchId && matchDate;
          });

          if (daySwipes.length === 0) return { label: "0.0 / 0.0" };

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

          if (ins.length === 0 || outs.length === 0)
            return { label: "0.0 / 0.0" };

          const firstInTime = ins[0].time;
          const lastOutTime = outs[outs.length - 1].time;

          const [inH, inM] = firstInTime.split(":").map(Number);
          const [outH, outM] = lastOutTime.split(":").map(Number);

          if (isNaN(inH) || isNaN(outH)) return { label: "0.0 / 0.0" };

          const totalHours = (outH * 60 + outM - (inH * 60 + inM)) / 60;

          if (totalHours <= 0) return { label: "0.0 / 0.0" };

          const standardCap = 8.5;
          let worked = totalHours > standardCap ? standardCap : totalHours;
          let ot = totalHours > standardCap ? totalHours - standardCap : 0;

          cumulativeRegular += worked;
          cumulativeOvertime += ot;

          return { label: `${worked.toFixed(1)} / ${ot.toFixed(1)}` };
        });

        return {
          ...emp,
          dailyBreakdown,
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

  const isDataSyncing = isLoadingEmployees || isLoadingAttendance;

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen p-6 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* --- DYNAMIC CASCADE FILTER SECTION --- */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="p-4 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-green-700" /> GoFresh
              Department Cascade
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
                <option value="Evaluation">Evaluation</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* --- WIREFRAME MAIN ROSTER DATA SUMMARY --- */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="p-4 bg-slate-50/50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-2">
              Timesheet Overview:{" "}
              <span className="text-green-700">{selectedDept}</span> &rarr;{" "}
              {selectedCC}
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
                  : "No workers found matching chosen criteria. Check your Sub-center value (Fillet vs Evaluation)."}
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
                      <TableHead className="text-center p-3">Mon</TableHead>
                      <TableHead className="text-center p-3">Tue</TableHead>
                      <TableHead className="text-center p-3">Wed</TableHead>
                      <TableHead className="text-center p-3">Thu</TableHead>
                      <TableHead className="text-center p-3">Fri</TableHead>
                      <TableHead className="text-center p-3">Sat</TableHead>
                      <TableHead className="text-center p-3">Sun</TableHead>
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
                          const hasHours = day.label !== "0.0 / 0.0";

                          return (
                            <TableCell
                              key={dayIdx}
                              className={`p-3 text-center font-mono text-xs transition-all ${
                                hasHours
                                  ? "text-emerald-600 font-bold drop-shadow-[0_0_6px_rgba(5,150,105,0.2)] bg-emerald-50/30"
                                  : "text-slate-400 font-normal"
                              }`}
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