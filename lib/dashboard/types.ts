/* ------------------------------------------------------------------ */
/* Lookup tables + compact row tuples                                 */
/*                                                                     */
/* Mirrors the payload shape generate_dashboard.py builds: instead of */
/* shipping full strings on every row, every dimension is "interned"  */
/* into a lookup array and rows just carry small integer indexes.     */
/* This keeps ~700k transaction rows workable in the browser.         */
/* ------------------------------------------------------------------ */

export interface Lookups {
  shops: string[];
  regs: string[];
  prods: string[];
  segs: string[];
  cats: string[];
  dates: string[]; // sorted ascending, 'YYYY-MM-DD'
}

/**
 * [dateIdx, hour, weekday, shopIdx, regionIdx, prodIdx, segIdx, catIdx,
 *  qty, amount, wght, invoiceIdx]
 * -1 means "no value" for any index/hour/weekday slot.
 */
export type RawRow = [
  number, number, number, number, number, number,
  number, number, number, number, number, number
];

export interface RawDataset {
  lookups: Lookups;
  rows: RawRow[];
}

/* ------------------------------------------------------------------ */
/* The aggregated "D" shape every panel renders from                  */
/* ------------------------------------------------------------------ */

export interface ShopRow {
  shop: string;
  total: number;
  chicken: number;
  beef: number;
  egg: number;
  trading: number;
  wght: number;
  mwk_per_kg: number;
  baskets: number;
  avg_basket: number;
}

export interface ProductRow {
  name: string;
  rev: number;
  qty: number;
  wght: number;
  mwk_per_kg: number;
  baskets: number;
  avg_basket: number;
  seg: string;
  cat: string;
  pct: number;
}

export interface MonthRow {
  key: string; // 'YYYY-MM'
  label: string; // 'Jan 26'
  turnover: number;
  volume: number;
  n_shops: number;
  n_days: number;
  mwk_per_kg: number;
  avg_daily_per_shop: number;
}

export interface RegionHourSeries {
  rev: number[];
  qty: number[];
}

export interface ShopHourSeries {
  shop: string;
  total: number;
  rev: number[];
  avg_basket: number[];
}

export interface DashboardData {
  totals: {
    rev: number;
    qty: number;
    rows: number;
    n_days: number;
    n_shops: number;
    wght: number;
    nsv_per_kg: number;
    baskets: number;
  };
  segments: { labels: string[]; data: number[]; qty: number[]; wght: number[] };
  regions: {
    labels: string[];
    data: number[];
    qty: number[];
    n_shops: number[];
    avg_per_shop: number[];
  };
  days: { labels: string[]; rev: number[]; qty: number[] };
  hours: { labels: string[]; rev: number[]; qty: number[] };
  weekdays: { labels: string[]; rev: number[] };
  cats: { labels: string[]; data: number[] };
  shops: ShopRow[];
  products: ProductRow[];
  region_hour: Record<string, RegionHourSeries>;
  shop_hour: ShopHourSeries[];
  date_range: string;
  months: MonthRow[];
}