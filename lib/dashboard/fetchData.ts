// lib/dashboard/fetchData.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardData } from "./types";

export async function fetchDashboardSummary(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<DashboardData> {
  const { data, error } = await supabase.rpc("get_dashboard_summary", {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) {
    throw new Error(`Failed to fetch dashboard summary: ${error.message}`);
  }

  return data as DashboardData;
}