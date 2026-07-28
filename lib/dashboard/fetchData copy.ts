import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lookups, RawRow, RawDataset } from "./types";

const COLUMNS =
  "sale_date,hour,weekday,shop_name,region,product_name,segment,category,qty,amount,wght,invoice_no";

// How many rows to request per page. Supabase's PostgREST layer caps the
// rows returned per request (Project Settings -> API -> "Max Rows", default
// 1000). Raise that setting if you want fewer, bigger round trips — this
// code will just do more pages if it's left at the default.
const PAGE_SIZE = 1000;

/**
 * Streams every row out of `retail_sales`, in pages, and interns each
 * dimension (shop, region, product, segment, category, date, invoice) into
 * a lookup array — mirroring the "idx()" interning generate_dashboard.py
 * does — so the browser holds compact number tuples instead of repeating
 * the same strings on every one of the ~700k rows.
 */
export async function fetchRetailDataset(
  supabase: SupabaseClient,
  onProgress?: (loaded: number) => void
): Promise<RawDataset> {
  const shops: Record<string, number> = {};
  const regs: Record<string, number> = {};
  const prods: Record<string, number> = {};
  const segs: Record<string, number> = {};
  const cats: Record<string, number> = {};
  const dates: Record<string, number> = {};
  const invs: Record<string, number> = {};

  const idx = (store: Record<string, number>, val: unknown): number => {
    if (val === null || val === undefined || val === "") return -1;
    const key = String(val);
    if (!(key in store)) store[key] = Object.keys(store).length;
    return store[key];
  };

  const rows: RawRow[] = [];
  let from = 0;
  let loaded = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("retail_sales")
      .select(COLUMNS)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`Failed loading retail_sales: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const r of data as any[]) {
      if (!r.sale_date) continue; // rows with no date can't be placed on the timeline
      const dateStr = String(r.sale_date).slice(0, 10);

      rows.push([
        idx(dates, dateStr),
        r.hour ?? -1,
        r.weekday ?? -1,
        idx(shops, r.shop_name),
        idx(regs, r.region),
        idx(prods, r.product_name),
        idx(segs, r.segment),
        idx(cats, r.category),
        Number(r.qty) || 0,
        Number(r.amount) || 0,
        Number(r.wght) || 0,
        idx(invs, r.invoice_no),
      ]);
    }

    loaded += data.length;
    onProgress?.(loaded);

    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  // Dates must be sorted for range-filtering; remap indexes to match.
  const sortedDates = Object.keys(dates).sort();
  const remap = new Map<number, number>();
  sortedDates.forEach((d, newIdx) => remap.set(dates[d], newIdx));
  for (const row of rows) row[0] = remap.get(row[0])!;

  const toArray = (store: Record<string, number>): string[] => {
    const arr: string[] = new Array(Object.keys(store).length);
    for (const key of Object.keys(store)) arr[store[key]] = key;
    return arr;
  };

  const lookups: Lookups = {
    shops: toArray(shops),
    regs: toArray(regs),
    prods: toArray(prods),
    segs: toArray(segs),
    cats: toArray(cats),
    dates: sortedDates,
  };

  return { lookups, rows };
}