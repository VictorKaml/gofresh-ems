"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Terminal, ShieldCheck, Activity, LockKeyhole } from "lucide-react";

export default function LoginPortal() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const executeSystemEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErr(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || "Authentication structural fault.");
      
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setErr(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex bg-slate-950 text-slate-100 min-h-screen items-center justify-center p-4 selection:bg-blue-600">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="space-y-1.5 border-b border-slate-800/60 p-6 bg-slate-950/40">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-black text-xs shadow-md">GF</div>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block font-mono">SYSTEM_AUTH_LAYER</span>
          </div>
          <CardTitle className="text-xl font-black tracking-wide uppercase text-slate-100">GOFRESH ACCESS TERMINAL</CardTitle>
          <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-wider">Initialize workforce pipeline control matrices.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {err && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-xs font-bold text-red-400 font-mono flex items-center gap-2">
              <Terminal className="w-4 h-4 text-red-500 shrink-0" /> {err}
            </div>
          )}
          <form onSubmit={executeSystemEntry} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">ACCOUNT EMAIL IDENTITY</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@gofreshmw.com" className="bg-slate-950 border-slate-800 focus:border-blue-600 font-bold uppercase text-xs h-10 text-white rounded-lg placeholder:text-slate-700" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">SECURITY ASSIGNMENT PIN</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="bg-slate-950 border-slate-800 focus:border-blue-600 font-mono text-xs h-10 text-white rounded-lg placeholder:text-slate-700" />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 font-black text-xs uppercase tracking-widest shadow-lg mt-2 gap-2">
              {isSubmitting ? <Activity className="w-4 h-4 animate-spin text-white" /> : <ShieldCheck className="w-4 h-4" />}
              {isSubmitting ? "AUTHENTICATING NODE..." : "INITIALIZE PIPELINE ACCESS"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}