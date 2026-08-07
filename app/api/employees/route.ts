// app/api/employees/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server"; // Using your project's server utility pattern
import { getOperatorScope } from "@/lib/get-operator-scope";

export const dynamic = "force-dynamic";

/**
 * FETCH CURRENT EMPLOYEE ROSTER
 * Scoped server-side to the logged-in operator's department / cost center.
 * Superusers see everyone. Operators with no department/cost center
 * assigned see nothing until an admin assigns one.
 */
export async function GET() {
  try {
    const scope = await getOperatorScope();
    if (!scope) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = await createClient();

    let query = supabase
      .from("employees")
      .select("staff_code, full_name, designation, department, cost_center, sub_center, sub_item, shift_type")
      .order("staff_code", { ascending: true });

    if (!scope.isSuperuser) {
      if (!scope.department) {
        // Unassigned operator: sees no employees until an admin assigns a department
        return NextResponse.json([], { status: 200 });
      }
      query = query.eq("department", scope.department);
      if (scope.costCenter) {
        query = query.eq("cost_center", scope.costCenter);
      }
    }

    const { data: employees, error } = await query;

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
      subCenter: emp.sub_center || "", 
      subItem: emp.sub_item || "Wholebirds", // Added subItem mapping fallback
      shiftType: emp.shift_type || "day",
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
    const scope = await getOperatorScope();
    if (!scope) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    
    // Support picking up both camelCase or snake_case parameters dynamically from the request body
    const staff_code = body.staff_code || body.staffCode;
    const full_name = body.full_name || body.fullName;
    const designation = body.designation;
    const department = body.department;
    const cost_center = body.cost_center || body.costCenter;
    const sub_center = body.sub_center || body.subCenter;
    const sub_item = body.sub_item || body.subItem;
    const shiftTypeRaw = (body.shift_type || body.shiftType || "day").toString().toLowerCase();
    const shift_type = shiftTypeRaw === "night" ? "night" : "day";

    // 1. Precise Server-Side Input Validation (Now ensuring both sub_center and sub_item fields exist)
    if (!staff_code || !full_name || !designation || !department || !cost_center || !sub_center || !sub_item) {
      return NextResponse.json(
        { error: "Missing required employee schema fields including sub_center or sub_item." },
        { status: 400 }
      );
    }

    // Non-superusers may only register employees inside their own assigned scope
    if (!scope.isSuperuser) {
      if (!scope.department || department.trim() !== scope.department) {
        return NextResponse.json(
          { error: "You are not authorized to register employees outside your assigned department." },
          { status: 403 }
        );
      }
      if (scope.costCenter && cost_center.trim() !== scope.costCenter) {
        return NextResponse.json(
          { error: "You are not authorized to register employees outside your assigned cost center." },
          { status: 403 }
        );
      }
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
          sub_center: sub_center.trim(), 
          sub_item: sub_item.trim(), // Insert sub_item into DB
          shift_type,
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
      subCenter: data.sub_center, 
      subItem: data.sub_item, // Return subItem back to client state
      shiftType: data.shift_type,
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