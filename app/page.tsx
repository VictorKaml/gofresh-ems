"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LogIn, AlertCircle, ArrowLeft, Calendar, ShieldCheck } from "lucide-react";

export default function IntegratedPortal() {
  const router = useRouter();
  
  // Search state variables
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [attendanceTable, setAttendanceTable] = useState<any[]>([]);
  const [dayFilter, setDayFilter] = useState("ALL");
  const [isSearching, setIsSearching] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);

  // Administrative login overlay states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live query auto-complete search loop
  useEffect(() => {
    if (searchQuery.trim().length < 2 || (selectedEmp && searchQuery === selectedEmp.fullName)) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/public-search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedEmp]);

  // Handle choice selection from list suggestions
  const handleSelectEmployee = async (emp: any) => {
    setSelectedEmp(emp);
    setSuggestions([]);
    setSearchQuery(emp.fullName);
    setIsTableLoading(true);

    // Pull from primary analytical report pipeline
    try {
      const res = await fetch(`/api/analytics`);
      if (res.ok) {
        const data = await res.json();
        const reports = data.processedReports || {};
        setAttendanceTable(reports[emp.staffCode] || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      // Small artificial hold to showcase structural loading transition layout cleanly
      setTimeout(() => setIsTableLoading(false), 600);
    }
  };

  // Reset the portal state to global search layout
  const resetSearchState = () => {
    setSelectedEmp(null);
    setSearchQuery("");
    setAttendanceTable([]);
    setDayFilter("ALL");
  };

  // Administrator authenticating endpoint handler 
  const executeSystemEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || "Incorrect email or password.");
      
      setShowLoginModal(false);
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client-side conditional display filtering computation
  const filteredRecords = attendanceTable.filter((row: any) => {
    if (dayFilter === "ALL") return true;
    return row.weekDay.toLowerCase() === dayFilter.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-between text-slate-900 font-sans relative selection:bg-blue-600 selection:text-white antialiased">
      
      {/* Dynamic Navigation Header Banner */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex justify-between items-center bg-white/60 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/50 rounded-b-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-sm bg-white border border-slate-200 p-1 flex items-center justify-center">
            <img 
              src="/gofresh_logo.jpg" 
              alt="GoFresh Logo" 
              className="object-contain max-w-full max-h-full" 
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-base tracking-tight text-slate-900 leading-tight">GoFresh</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-0.5">Workforce Portal</span>
          </div>
        </div>
        <Button 
          onClick={() => { setLoginError(null); setShowLoginModal(true); }}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm border border-slate-800 transition-all flex items-center gap-2 active:scale-95"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          Manager Login
        </Button>
      </header>

      {/* Main Framework Processing Core Layout */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 max-w-7xl w-full mx-auto py-16">
        
        {!selectedEmp ? (
          /* GOOGLE INSPIRED SEARCH MODULE SPLASH SCREEN */
          <div className="w-full max-w-xl text-center flex flex-col items-center animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="relative w-24 h-24 mb-6 rounded-3xl overflow-hidden shadow-xl border-2 border-white bg-white p-2 animate-bounce [animation-duration:3s]">
              <img 
                src="/gofresh_logo.jpg" 
                alt="GoFresh Large Logo" 
                className="object-contain w-full h-full" 
              />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3">
              Find Your Attendance
            </h1>
            <p className="text-slate-500 mb-8 text-sm md:text-base max-w-md font-medium">
              Enter your name or employee code below to view your weekly hours, overtime, and shifts.
            </p>

            {/* Standard Search Box Wrapper */}
            <div className="w-full relative shadow-xl rounded-2xl bg-white border border-slate-200/80 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all duration-300 group">
              <div className="flex items-center px-5 py-4.5">
                {isSearching ? (
                  /* Custom Animated Bubble Load Sequence Loop */
                  <div className="flex items-center gap-1 mr-3 w-5 h-5 justify-center">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                  </div>
                ) : (
                  <Search className="h-5 w-5 text-slate-400 mr-3 group-focus-within:text-blue-500 transition-colors" />
                )}
                <input
                  type="text"
                  placeholder="Type your name or employee code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-semibold text-base"
                />
              </div>

              {/* Real-time Result List Overlays */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-3 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 text-left divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                  {suggestions.map((emp) => (
                    <button
                      key={emp.staffCode}
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full px-5 py-4 hover:bg-blue-50/50 flex flex-col text-left transition-all duration-150 relative group/item"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 scale-y-0 group-hover/item:scale-y-100 transition-transform origin-center"></div>
                      <span className="font-bold text-slate-800 text-sm group-hover/item:text-blue-600 transition-colors">{emp.fullName}</span>
                      <span className="text-xs text-slate-400 font-medium mt-0.5">{emp.staffCode} • {emp.designation}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : isTableLoading ? (
          /* SHIMMERING STRUCTURAL SKELETON DISPLAY WHILE ACCRUES MATRIX TRANSFERS */
          <div className="w-full flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden max-w-5xl">
            <div className="px-6 py-6 bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-3 w-20 bg-slate-800 rounded"></div>
                <div className="h-6 w-48 bg-slate-800 rounded"></div>
                <div className="h-4 w-32 bg-slate-800 rounded"></div>
              </div>
              <div className="h-8 w-36 bg-slate-800 rounded-lg"></div>
            </div>
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 animate-pulse">
                  <div className="h-4 w-24 bg-slate-100 rounded"></div>
                  <div className="h-4 w-16 bg-slate-100 rounded"></div>
                  <div className="h-4 w-20 bg-slate-100 rounded"></div>
                  <div className="h-6 w-16 bg-slate-100 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* DETAILED TABULAR ATTENDANCE OVERVIEW FOR THE SEARCHED EMPLOYEE */
          <div className="w-full max-w-5xl flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            
            {/* Upper Profile Context Identification */}
            <div className="px-6 py-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 relative">
              <div className="absolute right-6 top-6 opacity-10 pointer-events-none hidden sm:block">
                <img src="/gofresh_logo.jpg" alt="Watermark Logo" className="w-20 h-20 object-contain invert" />
              </div>
              <div className="space-y-1 relative z-10">
                <button 
                  onClick={resetSearchState}
                  className="text-xs font-bold text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors uppercase tracking-wider mb-2 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Search
                </button>
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  {selectedEmp.fullName}
                </h2>
                <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                  <span>Employee Code:</span>
                  <span className="font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{selectedEmp.staffCode}</span>
                </p>
              </div>

              {/* Dynamic Filter Select Trigger */}
              <div className="flex items-center gap-2 relative z-10">
                <Calendar className="w-4 h-4 text-slate-400" />
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Day Filter:</label>
                <select
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="bg-slate-800 text-white font-semibold text-xs px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-inner"
                >
                  <option value="ALL">Show All Days</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
            </div>

            {/* Attendance Report Sheet Data Display Grid */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4 flex items-center gap-2">
                      <img src="/gofresh_logo.jpg" alt="Icon" className="w-4 h-4 object-contain rounded" />
                      <span>Date</span>
                    </th>
                    <th className="px-6 py-4">Day</th>
                    <th className="px-6 py-4">Clock In</th>
                    <th className="px-6 py-4">Clock Out</th>
                    <th className="px-6 py-4 text-center">Regular Hours</th>
                    <th className="px-6 py-4 text-center">Overtime</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400 bg-slate-50/20 font-semibold">
                        No attendance records found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-blue-50/20 transition-all duration-150">
                        <td className="px-6 py-4 font-mono text-slate-900 text-xs font-bold">{row.date}</td>
                        <td className="px-6 py-4 text-slate-600 font-semibold">{row.weekDay}</td>
                        <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{row.checkIn || "—"}</td>
                        <td className="px-6 py-4 font-mono text-amber-600 font-bold">{row.checkOut || "—"}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-900">{row.totalShiftHours ? Math.min(row.totalShiftHours, 8) : 0} hrs</td>
                        <td className="px-6 py-4 text-center font-bold text-blue-600 bg-blue-50/10">{row.overtimeHours || 0} hrs</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-block px-3 py-1 text-xs font-black rounded-full border shadow-sm ${
                            row.status === "PRESENT" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : row.status === "LATE"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* POPUP OVERLAY WINDOW FOR SYSTEM MANAGERS ONLY */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-white border-slate-200 shadow-2xl rounded-2xl overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
            <CardHeader className="space-y-1 border-b border-slate-100 p-6 bg-slate-50 relative">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <img src="/gofresh_logo.jpg" alt="Logo mini" className="w-5 h-5 object-contain rounded" />
                  <CardTitle className="text-lg font-black tracking-wide text-slate-900">Manager Sign In</CardTitle>
                </div>
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl outline-none leading-none transition-colors"
                >
                  &times;
                </button>
              </div>
              <CardDescription className="text-xs text-slate-500 font-medium">Log in to view administrative reports and adjust settings.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" /> {loginError}
                </div>
              )}
              
              <form onSubmit={executeSystemEntry} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Email Address</label>
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    placeholder="name@gofreshmw.com" 
                    className="bg-white border-slate-200 focus:border-blue-500 text-slate-900 font-medium text-sm h-11 rounded-xl shadow-sm" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Password</label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    placeholder="••••••••" 
                    className="bg-white border-slate-200 focus:border-blue-500 text-sm h-11 rounded-xl shadow-sm" 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs uppercase tracking-wider shadow-md mt-2 gap-2 rounded-xl transition-all active:scale-98 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-1.5 justify-center">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                    </div>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Corporate Footing Content */}
      <footer className="w-full text-center py-5 text-xs text-slate-400 font-medium border-t border-slate-200/60 bg-white/40 backdrop-blur-sm">
        © 2026 GoFresh EMS. All system sign-in access points are securely logged.
      </footer>
    </div>
  );
}