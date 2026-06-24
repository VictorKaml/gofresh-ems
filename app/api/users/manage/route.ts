import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password, roleTier, isSuperuser, canIngestChrono, canModifyRoster } = await request.json();
    const supabase = await createClient();

    // 1. Generate the hash
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { error } = await supabase
      .from("system_users")
      .insert([{
        email: email.toLowerCase().trim(),
        password_hash: hashedPassword, // Store the hashed password
        role_tier: roleTier,
        is_superuser: isSuperuser,
        can_ingest_chrono: canIngestChrono,
        can_modify_roster: canModifyRoster
      }]);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal operational write fault." }, { status: 500 });
  }
}