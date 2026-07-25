import { NextResponse } from "next/server";
import { getOperatorScope } from "@/lib/get-operator-scope";

export async function GET() {
  try {
    const scope = await getOperatorScope();

    if (!scope) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: scope.id,
        email: scope.email,
        role: scope.roleTier,
        superuser: scope.isSuperuser,
        rights: {
          chrono: scope.canIngestChrono,
          roster: scope.canModifyRoster,
        },
        // 🔹 Live department / cost center scope, resolved fresh from the DB
        department: scope.department,
        costCenter: scope.costCenter,
      },
    });
  } catch (err) {
    console.error("Session lookup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}