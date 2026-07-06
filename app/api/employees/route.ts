// app/api/employees/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server"; // Using your project's server utility pattern

export const dynamic = "force-dynamic";

/**
 * FETCH CURRENT EMPLOYEE ROSTER
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Query your employee table from Supabase including the new sub_center column
    const { data: employees, error } = await supabase
      .from("employees")
      .select("staff_code, full_name, designation, department, cost_center, sub_center")
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
      subCenter: emp.sub_center || "", // Added subCenter mapping
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

/**
 * CREATE / INSERT NEW EMPLOYEE MUTATION
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { staff_code, full_name, designation, department, cost_center, sub_center } = body;

    // 1. Precise Server-Side Input Validation (Now checking for sub_center field)
    if (!staff_code || !full_name || !designation || !department || !cost_center || !sub_center) {
      return NextResponse.json(
        { error: "Missing required employee schema fields." },
        { status: 400 }
      );
    }

    // 2. Perform Database Operation matching your columns
    const { data, error } = await supabase
      .from("employees")
      .insert([
        {
          staff_code: staff_code.trim().toUpperCase(),
          full_name: full_name.trim().toUpperCase(),
          designation: designation.trim(),
          department: department.trim(),
          cost_center: cost_center.trim(),
          sub_center: sub_center.trim(), // Insert sub_center to DB
          updated_at: new Date().toISOString(), // Required column constraint
        },
      ])
      .select()
      .single();

    if (error) {
      // Catch PostgreSQL Primary Key conflict code (duplicate staff_code)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Employee ID Code "${staff_code}" already exists in GoFresh records.` },
          { status: 409 }
        );
      }
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the inserted row mapped back to camelCase properties for fast client state updating
    const formattedNewEmployee = {
      staffCode: data.staff_code,
      fullName: data.full_name,
      designation: data.designation,
      department: data.department,
      costCenter: data.cost_center,
      subCenter: data.sub_center, // Return subCenter to client state
    };

    return NextResponse.json(
      { message: "Employee registered successfully", employee: formattedNewEmployee },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Internal Server Error in POST /api/employees:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}