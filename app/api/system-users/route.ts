// src/app/api/system-users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Fetch all application system users from the database 
export async function GET() {
  try {
    const users = await prisma.systemUser.findMany({
      orderBy: {
        email: "asc",
      },
      select: {
        id: true,
        email: true,
        roleTier: true,        // 👈 Fixed from role_tier
        isSuperuser: true,     // 👈 Fixed from is_superuser
        canIngestChrono: true, // 👈 Fixed from can_ingest_chrono
        canModifyRoster: true, // 👈 Fixed from can_modify_roster
        createdAt: true,       // 👈 Fixed from created_at
      },
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("🔴 [SYSTEM USERS GET FAULT]:", error);
    return NextResponse.json(
      { success: false, error: "Internal Database Server Error" },
      { status: 500 }
    );
  }
}

// PATCH: Update user privilege tier roles or toggle permission flags
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, roleTier, isSuperuser, canIngestChrono, canModifyRoster } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required identifier parameter: id" },
        { status: 400 }
      );
    }

    // Build dynamic update payload matching camelCase fields
    const updateData: any = {};
    if (roleTier !== undefined) updateData.roleTier = roleTier;
    if (isSuperuser !== undefined) updateData.isSuperuser = isSuperuser;
    if (canIngestChrono !== undefined) updateData.canIngestChrono = canIngestChrono;
    if (canModifyRoster !== undefined) updateData.canModifyRoster = canModifyRoster;

    const updatedUser = await prisma.systemUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        roleTier: true,
      }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("🔴 [SYSTEM USERS PATCH FAULT]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to modify database role properties" },
      { status: 500 }
    );
  }
}

// DELETE: Completely remove an administrator or operator's database account profile
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter identifier: id" },
        { status: 400 }
      );
    }

    await prisma.systemUser.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "System access account completely revoked." });
  } catch (error: any) {
    console.error("🔴 [SYSTEM USERS DELETE FAULT]:", error);
    return NextResponse.json(
      { success: false, error: "Unable to process account removal request" },
      { status: 500 }
    );
  }
}