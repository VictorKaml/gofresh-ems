// src/app/api/system-users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// GET: Include department and costCenter
export async function GET() {
  try {
    const users = await prisma.systemUser.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        roleTier: true,
        isSuperuser: true,
        canIngestChrono: true,
        canModifyRoster: true,
        department: true, // 👈 Added
        costCenter: true, // 👈 Added
        createdAt: true,
      },
    });
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Database error" },
      { status: 500 },
    );
  }
}

// POST: Save department and costCenter
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      roleTier,
      isSuperuser,
      canIngestChrono,
      canModifyRoster,
      department,
      costCenter,
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.systemUser.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        roleTier: roleTier ?? "operator",
        isSuperuser: isSuperuser ?? false,
        canIngestChrono: canIngestChrono ?? true,
        canModifyRoster: canModifyRoster ?? false,
        department: department || null, // 👈 Added
        costCenter: costCenter || null, // 👈 Added
      },
      select: {
        id: true,
        email: true,
        roleTier: true,
        department: true,
        costCenter: true,
      },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 },
    );
  }
}

// PATCH: Allow updating department and costCenter
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      roleTier,
      isSuperuser,
      canIngestChrono,
      canModifyRoster,
      department,
      costCenter,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing user ID" },
        { status: 400 },
      );
    }

    const updateData: any = {};
    if (roleTier !== undefined) updateData.roleTier = roleTier;
    if (isSuperuser !== undefined) updateData.isSuperuser = isSuperuser;
    if (canIngestChrono !== undefined)
      updateData.canIngestChrono = canIngestChrono;
    if (canModifyRoster !== undefined)
      updateData.canModifyRoster = canModifyRoster;
    if (department !== undefined) updateData.department = department; // 👈 Added
    if (costCenter !== undefined) updateData.costCenter = costCenter; // 👈 Added

    const updatedUser = await prisma.systemUser.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 },
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
        { status: 400 },
      );
    }

    await prisma.systemUser.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "System access account completely revoked.",
    });
  } catch (error: any) {
    console.error("🔴 [SYSTEM USERS DELETE FAULT]:", error);
    return NextResponse.json(
      { success: false, error: "Unable to process account removal request" },
      { status: 500 },
    );
  }
}
