import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Support parsing both direct arrays or wrapped { employees: [...] } structures
    const employees = Array.isArray(body) ? body : body.employees;

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: "Invalid layout data format." }, { status: 400 });
    }

    const supabase = await createClient();

    // Explicitly format keys down to snake_case properties mapping to the Postgres table
    const recordsToUpsert = employees.map((emp: any) => ({
      staff_code: String(emp.staffCode || emp.staff_code || "").trim().toUpperCase(),
      full_name: String(emp.fullName || emp.full_name || "").trim().toUpperCase(),
      designation: String(emp.designation || "Operator").trim(),
      department: String(emp.department || emp.department_name || "Go Fresh Chicken").trim(),
      cost_center: String(emp.costCenter || emp.cost_center || "Chicken Abattoir").trim(),
      // sub_center / sub_item default to "" (not a fake value) when the client
      // doesn't send one — most departments genuinely have no sub_item, and
      // only "Processing" staff carry Fillets/Mixed Portion/Drumsticks/Cutlets/Wings.
      sub_center: String(emp.subCenter || emp.sub_center || "").trim(),
      sub_item: String(emp.subItem || emp.sub_item || "").trim(),
      shift_type: String(emp.shiftType || emp.shift_type || "day").trim().toLowerCase() === "night" ? "night" : "day",
      updated_at: new Date().toISOString(),
    })).filter(emp => emp.staff_code && emp.full_name);

    if (recordsToUpsert.length === 0) {
      return NextResponse.json({ error: "No valid records parsed." }, { status: 400 });
    }

    // Perform massive single-roundtrip upsert bypassing duplication crashes
    const { data, error } = await supabase
      .from("employees")
      .upsert(recordsToUpsert, { onConflict: "staff_code" })
      .select();

    if (error) {
      console.error("Supabase bulk insert failure:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${data.length} profiles inside the database matrix.`,
      count: data.length
    }, { status: 201 });

  } catch (error: any) {
    console.error("Internal Server Error during bulk seed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}