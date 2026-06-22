// src/app/api/attendance/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch absolutely all records sorted chronologically
    const { data: records, error } = await supabase
      .from("attendance_records")
      .select("*")
      .limit(50000) // Optional: Set a reasonable limit to prevent overwhelming responses
      .order("swipe_date", { ascending: false })
      .order("swipe_time", { ascending: false });

    if (error) {
      console.error("Supabase full table scan fetch failure:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Remap database columns to frontend keys
    const mappedSwipes = (records || []).map((row: any) => ({
      id: row.staff_code,
      date: row.swipe_date,
      weekDay: row.weekday || "Unknown",
      time: row.swipe_time,
      type: row.swipe_type,
      isManualOverride: row.is_manual_override
    }));

    return NextResponse.json({
      success: true,
      swipes: mappedSwipes,
      attendance_records: mappedSwipes
    }, { status: 200 });

  } catch (error: any) {
    console.error("Attendance route exception:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}