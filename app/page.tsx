"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, LogIn, AlertCircle, ArrowLeft } from "lucide-react";

export default function IntegratedPortal() {
  const router = useRouter();
  
  // Search state variables
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [attendanceTable, setAttendanceTable] = useState<any[]>([]);
  const [dayFilter, setDayFilter] = useState("ALL");
  const [isSearching, setIsSearching] = useState(false);

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

    // Pull from primary analytical report pipeline
    try {
      const res = await fetch(`/api/analytics`);
      if (res.ok) {
        const data = await res.json();
        // Read out matching processed tracking matrix array
        const reports = data.processedReports || {};
        setAttendanceTable(reports[emp.staffCode] || []);
      }
    } catch (err) {
      console.error(err);
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 font-sans relative selection:bg-blue-600 selection:text-white">
      
      {/* Dynamic Navigation Header Banner */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-2 font-black text-xl tracking-tight text-slate-900">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm shadow-md font-black">GF</div>
          <span>GoFresh <span className="font-light text-slate-500">EMS</span></span>
        </div>
        <Button 
          onClick={() => { setLoginError(null); setShowLoginModal(true); }}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider px-4 py-2 rounded-lg shadow-sm"
        >
          Manager Login
        </Button>
      </header>

      {/* Main Framework Processing Core Layout */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 max-w-6xl w-full mx-auto pb-24">
        
        {!selectedEmp ? (
          /* GOOGLE INSPIRED SEARCH MODULE SPLASH SCREEN */
          <div className="w-full max-w-xl text-center flex flex-col items-center animate-in fade-in duration-300">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3">
              Find Your Attendance
            </h1>
            <p className="text-slate-500 mb-8 text-sm md:text-base max-w-md">
              Enter your name or employee code below to view your weekly hours, overtime, and shifts.
            </p>

            {/* Standard Search Box Wrapper */}
            <div className="w-full relative shadow-lg rounded-full bg-white border border-slate-200/80 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition duration-200">
              <div className="flex items-center px-5 py-4">
                {isSearching ? (
                  <Loader2 className="h-5 w-5 text-blue-500 mr-3 animate-spin" />
                ) : (
                  <Search className="h-5 w-5 text-slate-400 mr-3" />
                )}
                <input
                  type="text"
                  placeholder="Type your name or employee code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium text-base"
                />
              </div>

              {/* Real-time Result List Overlays */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-3 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 text-left divide-y divide-slate-100">
                  {suggestions.map((emp) => (
                    <button
                      key={emp.staffCode}
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full px-5 py-3.5 hover:bg-slate-50 flex flex-col text-left transition"
                    >
                      <span className="font-bold text-slate-800 text-sm">{emp.fullName}</span>
                      <span className="text-xs text-slate-400 font-medium mt-0.5">{emp.staffCode} • {emp.designation}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* DETAILED TABULAR ATTENDANCE OVERVIEW FOR THE SEARCHED EMPLOYEE */
          <div className="w-full flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Upper Profile Context Identification */}
            <div className="px-6 py-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
              <div className="space-y-1">
                <button 
                  onClick={resetSearchState}
                  className="text-xs font-bold text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition uppercase tracking-wider mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Search
                </button>
                <h2 className="text-2xl font-black tracking-tight">{selectedEmp.fullName}</h2>
                <p className="text-xs text-slate-400 font-medium">Employee Code: <span className="font-mono text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded">{selectedEmp.staffCode}</span></p>
              </div>

              {/* Dynamic Filter Select Trigger */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Day Filter:</label>
                <select
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="bg-slate-800 text-white font-semibold text-xs px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 transition cursor-pointer"
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
                    <th className="px-6 py-4">Date</th>
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
                      <td colSpan={7} className="text-center py-12 text-slate-400 bg-slate-50/30">
                        No attendance records found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition duration-150">
                        <td className="px-6 py-4 font-mono text-slate-900 text-xs">{row.date}</td>
                        <td className="px-6 py-4 text-slate-600">{row.weekDay} </td>
                        <td className="px-6 py-4 font-mono text-emerald-600">{row.checkIn || "—"}</td>
                        <td className="px-6 py-4 font-mono text-amber-600">{row.checkOut || "—"}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-900">{row.totalShiftHours ? Math.min(row.totalShiftHours, 8) : 0} hrs</td>
                        <td className="px-6 py-4 text-center font-bold text-blue-600">{row.overtimeHours || 0} hrs</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-white border-slate-200 shadow-2xl rounded-2xl overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
            <CardHeader className="space-y-1 border-b border-slate-100 p-6 bg-slate-50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-black tracking-wide text-slate-900">Manager Sign In</CardTitle>
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl outline-none leading-none"
                >
                  &times;
                </button>
              </div>
              <CardDescription className="text-xs text-slate-500 font-medium">Log in to view administrative reports and adjust settings.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2">
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
                    className="bg-white border-slate-200 focus:border-blue-500 text-slate-900 font-medium text-sm h-10 rounded-xl" 
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
                    className="bg-white border-slate-200 focus:border-blue-500 text-sm h-10 rounded-xl" 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs uppercase tracking-wider shadow-md mt-2 gap-2 rounded-xl transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      Signing In...
                    </>
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
      <footer className="w-full text-center py-5 text-xs text-slate-400 font-medium border-t border-slate-200/60 bg-transparent">
        © 2026 GoFresh EMS. All system sign-in access points are securely logged.
      </footer>
    </div>
  );
}