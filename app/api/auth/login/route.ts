import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const supabase = await createClient();

    // 1. Fetch user by email
    const { data: user, error } = await supabase
      .from("system_users")
      .select("id, email, password_hash, role_tier, is_superuser, can_ingest_chrono, can_modify_roster")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // 2. Validate Password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // 3. Success - Set the session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        email: user.email,
        role: user.role_tier,
        superuser: user.is_superuser,
      },
    });

    response.cookies.set("gofresh_session", JSON.stringify({
        email: user.email,
        role: user.role_tier,
        isSuperuser: user.is_superuser,
        rights: {
          chrono: user.can_ingest_chrono,
          roster: user.can_modify_roster,
        },
    }), {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    });

    return response;

  } catch (err) {
    console.error("Auth System Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}