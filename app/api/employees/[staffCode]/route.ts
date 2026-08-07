// app/api/employees/[staffCode]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOperatorScope } from "@/lib/get-operator-scope";

export const dynamic = "force-dynamic";

/**
 * UPDATE AN EXISTING EMPLOYEE
 * Scoped the same way as POST /api/employees: non-superusers may only
 * edit employees inside their own assigned department / cost center,
 * and may not move an employee outside that scope either.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ staffCode: string }> },
) {
  try {
    const scope = await getOperatorScope();
    if (!scope) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { staffCode: rawStaffCode } = await params;
    const staffCode = decodeURIComponent(rawStaffCode).trim().toUpperCase();
    if (!staffCode) {
      return NextResponse.json({ error: "Missing staff code." }, { status: 400 });
    }

    const supabase = await createClient();
    const body = await request.json();

    // Load the existing record first so we can enforce scope both on the
    // employee's CURRENT assignment and on any NEW assignment being set.
    const { data: existing, error: fetchError } = await supabase
      .from("employees")
      .select("staff_code, department, cost_center")
      .eq("staff_code", staffCode)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: `Employee "${staffCode}" was not found.` },
        { status: 404 },
      );
    }

    if (!scope.isSuperuser) {
      if (!scope.department || existing.department !== scope.department) {
        return NextResponse.json(
          { error: "You are not authorized to edit employees outside your assigned department." },
          { status: 403 },
        );
      }
      if (scope.costCenter && existing.cost_center !== scope.costCenter) {
        return NextResponse.json(
          { error: "You are not authorized to edit employees outside your assigned cost center." },
          { status: 403 },
        );
      }
    }

    // Only touch fields that were actually sent — this is a partial update.
    const updateData: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };

    const fullName = body.full_name || body.fullName;
    if (fullName) updateData.full_name = String(fullName).trim().toUpperCase();

    const designation = body.designation;
    if (designation) updateData.designation = String(designation).trim();

    const department = body.department;
    if (department) updateData.department = String(department).trim();

    const costCenter = body.cost_center || body.costCenter;
    if (costCenter) updateData.cost_center = String(costCenter).trim();

    const subCenter = body.sub_center || body.subCenter;
    if (subCenter !== undefined) updateData.sub_center = String(subCenter).trim();

    const subItem = body.sub_item || body.subItem;
    if (subItem !== undefined) updateData.sub_item = String(subItem).trim();

    const shiftTypeRaw = body.shift_type || body.shiftType;
    if (shiftTypeRaw !== undefined) {
      updateData.shift_type = String(shiftTypeRaw).trim().toLowerCase() === "night" ? "night" : "day";
    }

    // A non-superuser is not allowed to reassign an employee to a
    // department/cost center outside their own scope either.
    if (!scope.isSuperuser) {
      if (updateData.department && updateData.department !== scope.department) {
        return NextResponse.json(
          { error: "You cannot move an employee outside your assigned department." },
          { status: 403 },
        );
      }
      if (scope.costCenter && updateData.cost_center && updateData.cost_center !== scope.costCenter) {
        return NextResponse.json(
          { error: "You cannot move an employee outside your assigned cost center." },
          { status: 403 },
        );
      }
    }

    const { data, error } = await supabase
      .from("employees")
      .update(updateData)
      .eq("staff_code", staffCode)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedEmployee = {
      staffCode: data.staff_code,
      fullName: data.full_name,
      designation: data.designation,
      department: data.department,
      costCenter: data.cost_center,
      subCenter: data.sub_center,
      subItem: data.sub_item,
      shiftType: data.shift_type,
    };

    return NextResponse.json(
      { message: "Employee updated successfully", employee: formattedEmployee },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Internal Server Error in PATCH /api/employees/[staffCode]:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
