import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const segment = searchParams.get("segment");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    let query = supabase
      .from("retail_sales")
      .select("*")
      .order("sale_date", { ascending: false })
      .limit(limit);

    if (shop) {
      query = query.ilike("shop_name", `%${shop}%`);
    }
    if (segment) {
      query = query.eq("segment", segment);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error: any) {
    console.error("Database retrieval error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve sales statistics." },
      { status: 500 }
    );
  }
}