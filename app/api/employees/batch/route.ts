import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employees } = body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: "Invalid layout data format." }, { status: 400 });
    }

    // Use Prisma v7 native createMany with upsert handling features
    // or direct native query to execute everything in exactly ONE database roundtrip
    await prisma.$executeRawUnsafe(`
      INSERT INTO employees (staff_code, full_name, designation, department, cost_center, updated_at)
      VALUES ${employees.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}, NOW())`).join(", ")}
      ON CONFLICT (staff_code) 
      DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        designation = EXCLUDED.designation,
        department = EXCLUDED.department,
        cost_center = EXCLUDED.cost_center,
        updated_at = NOW();
    `, ...employees.flatMap(emp => [
      emp.staffCode,
      emp.fullName,
      emp.designation || "Operator",
      emp.department || "Operations",
      emp.costCenter || "CC-LOCAL"
    ]));

    return NextResponse.json({ success: true, count: employees.length });
  } catch (error: any) {
    console.error("Batch processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}