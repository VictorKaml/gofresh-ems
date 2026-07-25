// src/app/api/attendance/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOperatorScope } from "@/lib/get-operator-scope";

export async function GET(request: Request) {
  try {
    const scope = await getOperatorScope();
    if (!scope) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // 📅 Extract date filters from query string
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const page = parseInt(searchParams.get("page") || "0", 10);
    const size = parseInt(searchParams.get("size") || "25000", 10); 

    const offsetStart = page * size;
    const offsetEnd = offsetStart + size - 1;
    const supabase = await createClient();

    // 🔒 Resolve which staff codes this operator is allowed to see.
    // null = superuser, no restriction. Empty array/unassigned = short-circuit.
    let allowedStaffCodes: string[] | null = null;

    if (!scope.isSuperuser) {
      if (!scope.department) {
        // Unassigned operator: no attendance records visible until an admin
        // assigns a department / cost center.
        return NextResponse.json(
          {
            success: true,
            swipes: [],
            hasMore: false,
            attendance_records: [],
          },
          { status: 200 },
        );
      }

      let scopeQuery = supabase
        .from("employees")
        .select("staff_code")
        .eq("department", scope.department);

      if (scope.costCenter) {
        scopeQuery = scopeQuery.eq("cost_center", scope.costCenter);
      }

      const { data: scopedEmployees, error: scopeError } = await scopeQuery;

      if (scopeError) {
        console.error("Scope lookup failure:", scopeError);
        return NextResponse.json({ error: scopeError.message }, { status: 500 });
      }

      const scopedStaffCodes = (scopedEmployees || []).map(
        (e: any) => e.staff_code,
      );
      allowedStaffCodes = scopedStaffCodes;

      if (scopedStaffCodes.length === 0) {
        return NextResponse.json(
          {
            success: true,
            swipes: [],
            hasMore: false,
            attendance_records: [],
          },
          { status: 200 },
        );
      }
    }

    // Begin query chain
    let query = supabase
      .from("attendance_records")
      .select("*")
      .order("swipe_date", { ascending: false })
      .order("swipe_time", { ascending: false });

    // Apply filters if they exist
    if (startDate) {
      query = query.gte("swipe_date", startDate);
    }
    if (endDate) {
      query = query.lte("swipe_date", endDate);
    }

    if (allowedStaffCodes) {
      query = query.in("staff_code", allowedStaffCodes);
    }

    // Apply pagination bounds safety over data chunks
    query = query.range(offsetStart, offsetEnd);

    const { data: records, error } = await query;

    if (error) {
      console.error("Supabase range query failure:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Remap database columns to frontend keys (INCLUDING adjusted_by & change_reason)
    const mappedSwipes = (records || []).map((row: any) => ({
      id: row.staff_code,
      staffCode: row.staff_code,
      date: row.swipe_date,
      swipe_date: row.swipe_date,
      weekDay: row.weekday || "Unknown",
      time: row.swipe_time,
      swipe_time: row.swipe_time,
      type: row.swipe_type,
      swipe_type: row.swipe_type,
      isManualOverride: row.is_manual_override,
      adjusted_by: row.adjusted_by,
      adjustedBy: row.adjusted_by,
      reason: row.change_reason,
      change_reason: row.change_reason
    }));

    // Determine if more records exist in this specific range
    const hasMore = records.length === size;

    return NextResponse.json({
      success: true,
      swipes: mappedSwipes,
      hasMore,
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