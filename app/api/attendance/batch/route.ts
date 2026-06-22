// src/app/api/attendance/batch/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const { records, operatorEmail } = await request.json();

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Empty or invalid records array payload." }, { status: 400 });
    }

    const supabase = await createClient();

    // Map frontend fields safely to database schema columns
    const databasePayload = records.map((rec: any) => ({
      staff_code: String(rec.id || rec.staffCode).toUpperCase().trim(),
      swipe_date: rec.date,
      weekday: rec.weekDay || rec.weekday,
      swipe_time: rec.time,
      swipe_type: rec.type,
      is_manual_override: rec.isManualOverride || false,
      adjusted_by: operatorEmail || "SYSTEM_INGEST_CHRONO",
      change_reason: rec.reason || "Bulk Biometric Log Synchronization Sequence"
    }));

    // CRITICAL FIX: Change from .insert() to .upsert() 
    // specifying the exact unique index columns responsible for the 23505 error
    const { error } = await supabase
      .from("attendance_records")
      .upsert(databasePayload, {
        onConflict: "staff_code,swipe_date,swipe_time,swipe_type",
        ignoreDuplicates: true // Set to true to skip over records already present in the database safely
      });

    if (error) {
      console.error("Supabase upsert failure execution:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed and synchronized ${databasePayload.length} chronological biometric records.` 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Chrono batch router exception:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}