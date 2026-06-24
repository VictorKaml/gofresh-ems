// src/app/api/system-users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch all authorized system users/administrators
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("🔴 [SYSTEM USERS GET FAULT]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Terminate an administrator or operator's access account
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing user ID parameter" }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true, message: "System access revoked successfully." });
  } catch (error: any) {
    console.error("🔴 [SYSTEM USERS DELETE FAULT]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}