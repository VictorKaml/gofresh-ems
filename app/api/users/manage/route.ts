import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, password, roleTier, isSuperuser, canIngestChrono, canModifyRoster } = await request.json();
    const supabase = await createClient();

    const { error } = await supabase
      .from("system_users")
      .insert([{
        email: email.toLowerCase().trim(),
        password_hash: password, // Store cleanly or use hash layers
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