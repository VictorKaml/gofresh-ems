// app/api/employees/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server"; // Adjust this path to match where your Supabase server client helper is defined

export async function GET() {
  try {
    const supabase = await createClient();

    // Query your employee table from Supabase
    // Replace 'employees' with your actual table name if it differs
    const { data: employees, error } = await supabase
      .from("employees")
      .select("staff_code, full_name, designation, department, cost_center")
      .order("staff_code", { ascending: true });

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map database snake_case fields to the camelCase interface expected by your frontend dashboard state
    const formattedEmployees = employees.map((emp: any) => ({
      staffCode: emp.staff_code || "",
      fullName: emp.full_name || "",
      designation: emp.designation || "",
      department: emp.department || "",
      costCenter: emp.cost_center || "",
    }));

    return NextResponse.json(formattedEmployees, { status: 200 });
  } catch (error: any) {
    console.error("Internal Server Error in GET /api/employees:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}