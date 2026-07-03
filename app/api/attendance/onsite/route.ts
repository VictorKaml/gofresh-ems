// src/app/api/attendance/onsite/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch active personnel currently logged in the view
    const { data: onsiteRecords, error } = await supabase
      .from("onsite_staff")
      .select("*");

    if (error) {
      console.error("Failed to fetch from onsite view:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map database view entries cleanly to match client structures
    const mappedOnsite = (onsiteRecords || []).map((row: any) => ({
      id: row.staff_code,
      date: row.swipe_date,
      time: row.swipe_time,
    }));

    return NextResponse.json({
      success: true,
      count: mappedOnsite.length,
      staff: mappedOnsite,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Onsite API handler error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}