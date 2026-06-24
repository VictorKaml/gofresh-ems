import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const supabase = await createClient();

    // 1. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Insert into database
    const { error } = await supabase.from("system_users").insert([{
      email: email.toLowerCase().trim(),
      password_hash: hashedPassword,
      role_tier: "admin",
      is_superuser: true,
      can_ingest_chrono: true,
      can_modify_roster: true
    }]);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true, message: "Admin seeded successfully" });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}