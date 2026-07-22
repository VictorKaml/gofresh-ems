// src/app/api/attendance/batch/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

// Helper function to validate UUID v4/v1/etc. syntax
function isValidUUID(str: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function POST(request: Request) {
  try {
    const { records, operatorEmail } = await request.json();

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Empty or invalid records array payload." }, { status: 400 });
    }

    // Resolve the actual logged-in system user's email so adjusted_by always
    // reflects a real, currently valid operator account rather than whatever
    // raw string the client happened to send (id, stale name, placeholder, etc).
    // If no operator is claimed at all, this is treated as an automated
    // biometric sync and falls back to the system placeholder as before.
    let resolvedOperatorEmail = "SYSTEM_INGEST_CHRONO";

    if (operatorEmail) {
      const rawValue = String(operatorEmail).trim();

      // Build OR conditions dynamically based on input format
      const whereConditions: any[] = [
        { email: rawValue.toLowerCase() }
      ];

      // Only query 'id' if the input string is a valid UUID syntax
      if (isValidUUID(rawValue)) {
        whereConditions.push({ id: rawValue });
      }

      // Client may send the email directly, or a system_users.id — check both.
     const matchedUser = await prisma.systemUser.findFirst({
        where: {
          OR: whereConditions,
        },
        select: { email: true },
      });

      if (!matchedUser?.email) {
        return NextResponse.json(
          {
            error:
              "Unable to verify the logged-in system user. Please sign in again before submitting attendance.",
          },
          { status: 401 }
        );
      }

      resolvedOperatorEmail = matchedUser.email;
    }

    const supabase = await createClient();

    // Map frontend fields safely to database schema columns
    const databasePayload = records.map((rec: any) => ({
      staff_code: String(rec.id || rec.staffCode).toUpperCase().trim(),
      swipe_date: rec.date,
      weekday: rec.weekDay || rec.weekday,
      swipe_time: rec.time,
      swipe_type: rec.type,
      is_manual_override: rec.isManualOverride || false,
      adjusted_by: resolvedOperatorEmail,
      change_reason: rec.reason || "Bulk Biometric Log Synchronization Sequence"
    }));

    // CRITICAL FIX: Change from .insert() to .upsert() 
    // specifying the exact unique index columns responsible for the 23505 error
    const { error } = await supabase
      .from("attendance_records")
      .upsert(databasePayload, {
        onConflict: "staff_code,swipe_date,swipe_time,swipe_type",
        ignoreDuplicates: true // Set to true to skip over records already present in the database safely
      });

    if (error) {
      console.error("Supabase upsert failure execution:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed and synchronized ${databasePayload.length} chronological biometric records.` 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Chrono batch Frouter exception:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}