import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const supabase = await createClient();

    // Query credentials from your system account database
    const { data: user, error } = await supabase
      .from("system_users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !user || user.password_hash !== password) {
      return NextResponse.json({ error: "Invalid systemic entry credentials mapping." }, { status: 401 });
    }

    // Set a lightweight simulation session payload cookie
    const response = NextResponse.json({ success: true, user: { email: user.email, role: user.role_tier, superuser: user.is_superuser } });
    response.cookies.set("gofresh_session", JSON.stringify({
      email: user.email,
      role: user.role_tier,
      isSuperuser: user.is_superuser,
      rights: { chrono: user.can_ingest_chrono, roster: user.can_modify_roster }
    }), {
      path: "/",
      httpOnly: true,
      maxAge: 60 * 60 * 8, // 8 hour working shifts tracking window
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Authentication system failure." }, { status: 500 });
  }
}