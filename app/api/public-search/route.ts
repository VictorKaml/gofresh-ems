// app/api/public-search/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Search for matches across full name or standard staff code
    const matchedEmployees = await prisma.employee.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { staffCode: { contains: query, mode: "insensitive" } }
        ]
      },
      select: { staffCode: true, fullName: true, designation: true },
      take: 5
    });

    return NextResponse.json({ success: true, results: matchedEmployees });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}