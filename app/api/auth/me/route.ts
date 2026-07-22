import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface GofreshSessionCookie {
  id: string;
  email: string;
  role: string;
  isSuperuser: boolean;
  rights: {
    chrono: boolean;
    roster: boolean;
  };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gofresh_session");

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let session: GofreshSessionCookie;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!session?.email) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.id,
        email: session.email,
        role: session.role,
        superuser: session.isSuperuser,
        rights: session.rights,
      },
    });
  } catch (err) {
    console.error("Session lookup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}