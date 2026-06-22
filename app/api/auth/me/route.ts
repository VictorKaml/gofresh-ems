import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    user: {
      id: "admin-uuid-root",
      email: "admin@gofresh.com",
      role: "superuser"
    }
  });
}