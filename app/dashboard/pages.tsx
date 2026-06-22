"use client";
import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LayoutDashboard, UserCheck, Users, Activity, LogIn, LogOut, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function GoFreshAnalyticsConsole() {
  const [currentTab, setCurrentTab] = useState<"OVERVIEW" | "REPORT_VIEW">("OVERVIEW");
  const [serverState, setServerState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [targetStaffCode, setTargetStaffCode] = useState("");

  useEffect(() => {
    fetch("/api/analytics")
      .then(res => res.json())
      .then(data => {
        setServerState(data);
        setLoading(false);
      });
  }, []);

  const employeeSelectionList = useMemo(() => {
    if (!serverState) return [];
    return serverState.employees;
  }, [serverState]);

  const activeEmployeeFile = useMemo(() => {
    if (!targetStaffCode || !serverState) return null;
    const profile = serverState.employees.find((e: any) => e.staffCode === targetStaffCode);
    const shiftRecords = serverState.processedReports[targetStaffCode] || [];
    return { profile, shiftRecords };
  }, [targetStaffCode, serverState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-black tracking-widest text-slate-400 uppercase">Compiling Enterprise Datasets...</p>
      </div>
    );
  }

  return (
    <div className="flex bg-[#f8fafc] text-slate-900 min-h-screen font-sans">
      
      {/* ─── SIDEBAR MATRIX NAVIGATION ─── */}
      <aside className="w-64 bg-slate-950 text-white flex flex-col justify-between fixed h-full p-4 border-r border-slate-900 shadow-2xl z-30">
        <div className="space-y-6">
          <div className="py-3 px-3 border-b border-slate-900 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-blue-500/20">GF</div>
            <div>
              <span className="font-black text-xs tracking-wider block text-slate-100">GoFresh Engine</span>
              <span className="text-[9px] font-bold text-blue-500 block tracking-widest uppercase">Analytics Active</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setCurrentTab("OVERVIEW")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${currentTab === "OVERVIEW" ? "bg-blue-600 text-white shadow-xl shadow-blue-600/10" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}>
              <LayoutDashboard className="w-4 h-4" /> PERFORMANCE DASHBOARD
            </button>
            <button onClick={() => setCurrentTab("REPORT_VIEW")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${currentTab === "REPORT_VIEW" ? "bg-blue-600 text-white shadow-xl shadow-blue-600/10" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}>
              <UserCheck className="w-4 h-4" /> INDIVIDUAL REPORT FILES
            </button>
          </nav>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
          System Core Layer Live
        </div>
      </aside>

      {/* ─── CENTRAL WORKSPACE FRAME ─── */}
      <main className="flex-1 pl-64 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200/80 px-8 py-4 sticky top-0 flex items-center justify-between shadow-sm z-20">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">MANAGEMENT CONTROL</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 text-xs font-black tracking-widest uppercase">{currentTab} PANEL</span>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* VIEW TAB: MANAGEMENT DASHBOARD METRICS */}
          {currentTab === "OVERVIEW" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Roster Headcount</p>
                      <p className="text-2xl font-black mt-1 text-slate-900">{serverState.metrics.totalEmployees}</p>
                    </div>
                    <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Users className="w-4 h-4" /></div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-blue-600">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Captured Swipes</p>
                      <p className="text-2xl font-black mt-1 text-blue-600">{serverState.metrics.totalPunches}</p>
                    </div>
                    <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Activity className="w-4 h-4" /></div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Check Ins</p>
                      <p className="text-2xl font-black mt-1 text-emerald-600">{serverState.metrics.totalCheckIns}</p>
                    </div>
                    <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><LogIn className="w-4 h-4" /></div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Check Outs</p>
                      <p className="text-2xl font-black mt-1 text-slate-500">{serverState.metrics.totalCheckOuts}</p>
                    </div>
                    <div className="w-9 h-9 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center"><LogOut className="w-4 h-4" /></div>
                  </CardContent>
                </Card>
              </div>

              {/* CURVED GRAPHS AND CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <CardHeader><CardTitle className="text-xs font-black text-slate-400 uppercase tracking-wider">Traffic Volumetric Load (Curved Line)</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={serverState.charts.trends}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{fontSize: 10, fontWeight: 700}} stroke="#94a3b8" />
                        <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                        <Tooltip />
                        <Line type="monotone" dataKey="volume" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <CardHeader><CardTitle className="text-xs font-black text-slate-400 uppercase tracking-wider">Verification Distribution</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serverState.charts.distribution}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700}} stroke="#94a3b8" />
                        <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* VIEW TAB: INDIVIDUAL REPORT SHEET GENERATOR */}
          {currentTab === "REPORT_VIEW" && (
            <div className="space-y-6">
              <Card className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Database Employee File</label>
                <select value={targetStaffCode} onChange={(e) => setTargetStaffCode(e.target.value)} className="w-full mt-1.5 px-4 py-2.5 bg-slate-50 border rounded-xl font-bold text-xs focus:outline-none focus:border-blue-500">
                  <option value="">Choose worker mapping sequence...</option>
                  {employeeSelectionList.map((emp: any) => (
                    <option key={emp.staffCode} value={emp.staffCode}>{emp.fullName} ({emp.staffCode})</option>
                  ))}
                </select>
              </Card>

              {activeEmployeeFile && (
                <div className="space-y-6">
                  <Card className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{activeEmployeeFile.profile.fullName}</h2>
                      <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">{activeEmployeeFile.profile.staffCode}</span> • {activeEmployeeFile.profile.departmentName} • {activeEmployeeFile.profile.designation}
                      </p>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 px-4 py-2.5 rounded-xl text-center">
                      <span className="text-[9px] font-black text-blue-500 block uppercase tracking-wider">Aggregated Shifts</span>
                      <span className="text-xl font-black text-blue-700">{activeEmployeeFile.shiftRecords.length}</span>
                    </div>
                  </Card>

                  {/* REPORT TIMELINE DATA SHEET TABLE */}
                  <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
                      <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-wider">Processed Shift Logs</CardTitle>
                    </CardHeader>
                    <Table>
                      <TableHeader className="bg-slate-50 font-bold text-xs">
                        <TableRow>
                          <TableHead className="px-6 py-3 uppercase text-slate-400 text-[10px]">Log Date</TableHead>
                          <TableHead className="uppercase text-slate-400 text-[10px]">Day</TableHead>
                          <TableHead className="text-center uppercase text-slate-400 text-[10px]">Clock In</TableHead>
                          <TableHead className="text-center uppercase text-slate-400 text-[10px]">Clock Out</TableHead>
                          <TableHead className="text-center uppercase text-slate-400 text-[10px]">Duration Hours</TableHead>
                          <TableHead className="text-center uppercase text-slate-400 text-[10px]">Overtime Allocation</TableHead>
                          <TableHead className="text-right px-6 uppercase text-slate-400 text-[10px]">Verification Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="font-semibold text-xs text-slate-700">
                        {activeEmployeeFile.shiftRecords.map((punch: any, index: number) => (
                          <TableRow key={index} className="hover:bg-slate-50/30 transition-colors">
                            <TableCell className="px-6 py-3.5 font-mono text-slate-500 font-bold">{punch.date}</TableCell>
                            <TableCell className="uppercase text-[11px] font-bold text-slate-400">{punch.weekDay}</TableCell>
                            <TableCell className="text-center font-mono font-bold text-slate-900">{punch.checkIn || "—"}</TableCell>
                            <TableCell className="text-center font-mono font-bold text-slate-900">{punch.checkOut || "—"}</TableCell>
                            <TableCell className="text-center font-mono font-black text-slate-900">{punch.totalShiftHours} hrs</TableCell>
                            <TableCell className="text-center">
                              {punch.overtimeHours > 0 ? (
                                <Badge className="bg-blue-600 text-white font-mono font-black text-[10px] rounded px-2">+{punch.overtimeHours} hr OT</Badge>
                              ) : <span className="text-slate-300 font-mono text-xs">—</span>}
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <Badge className={`font-black text-[9px] rounded px-2 py-0.5 uppercase tracking-wide ${
                                punch.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                punch.status === "LATE" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                              }`}>{punch.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}