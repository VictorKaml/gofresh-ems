import type {
  Lookups,
  RawRow,
  DashboardData,
  ShopRow,
  ProductRow,
  MonthRow,
} from "./types";

const WD_NAMES: Record<number, string> = {
  1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat",
};

const getMap = <K, V>(m: Map<K, Map<any, V>>, k: K): Map<any, V> => {
  let v = m.get(k);
  if (!v) { v = new Map(); m.set(k, v); }
  return v;
};
const getSet = <K, V>(m: Map<K, Set<V>>, k: K): Set<V> => {
  let v = m.get(k);
  if (!v) { v = new Set(); m.set(k, v); }
  return v;
};
const add = (m: Map<any, number>, k: any, v: number) => m.set(k, (m.get(k) || 0) + v);

/**
 * Direct port of the `computeD` function from generate_dashboard.py's HTML
 * template. Given the interned lookups + raw row tuples and a date-range
 * filter (inclusive, 'YYYY-MM-DD' strings), rebuilds every KPI, chart series
 * and table row the dashboard needs — same shape, same math.
 */
export function computeD(L: Lookups, ROWS: RawRow[], startDate: string, endDate: string): DashboardData {
  const segRev = new Map<string, number>(), segQty = new Map<string, number>(), segWght = new Map<string, number>();
  const dayRev = new Map<string, number>(), dayQty = new Map<string, number>();
  const hourRev = new Map<number, number>(), hourQty = new Map<number, number>();
  const shopRev = new Map<string, number>(), shopWght = new Map<string, number>();
  const shopSegRev = new Map<string, Map<string, number>>();
  const shopInv = new Map<string, Set<number>>();
  const shopRegion = new Map<string, string>();
  const shopHourRev = new Map<string, Map<number, number>>();
  const shopHourInv = new Map<string, Map<number, Set<number>>>();
  const regionRev = new Map<string, number>(), regionQty = new Map<string, number>();
  const regionHourRev = new Map<string, Map<number, number>>();
  const regionHourQty = new Map<string, Map<number, number>>();
  const prodRev = new Map<string, number>(), prodQty = new Map<string, number>(), prodWght = new Map<string, number>();
  const prodInv = new Map<string, Set<number>>();
  const prodMeta = new Map<string, { seg: string; cat: string }>();
  const catRev = new Map<string, number>();
  const wdRev = new Map<number, number>();
  const daysSet = new Set<string>();
  const monthRev = new Map<string, number>();
  const monthVol = new Map<string, number>();
  const monthShops = new Map<string, Set<number>>();
  const monthDays = new Map<string, Set<string>>();

  let nRows = 0;

  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    const dIdx = r[0];
    const dateStr = L.dates[dIdx];
    if (dateStr < startDate || dateStr > endDate) continue;

    const hour = r[1], wd = r[2];
    const shop = r[3] >= 0 ? L.shops[r[3]] : null;
    const region = r[4] >= 0 ? L.regs[r[4]] : null;
    const prod = r[5] >= 0 ? L.prods[r[5]] : null;
    const seg = r[6] >= 0 ? L.segs[r[6]] : null;
    const cat = r[7] >= 0 ? L.cats[r[7]] : null;
    const qty = r[8], amt = r[9], wght = r[10];
    const inv = r[11];

    daysSet.add(dateStr);
    const monthKey = dateStr.slice(0, 7);
    add(monthRev, monthKey, amt);
    add(monthVol, monthKey, wght);
    getSet(monthDays, monthKey).add(dateStr);
    if (shop && r[3] >= 0) getSet(monthShops, monthKey).add(r[3]);
    nRows++;

    if (seg) { add(segRev, seg, amt); add(segQty, seg, qty); add(segWght, seg, wght); }
    add(dayRev, dateStr, amt); add(dayQty, dateStr, qty);
    if (hour >= 0) { add(hourRev, hour, amt); add(hourQty, hour, qty); }
    if (shop) {
      add(shopRev, shop, amt); add(shopWght, shop, wght);
      if (region) shopRegion.set(shop, region);
      if (seg) add(getMap(shopSegRev, shop), seg, amt);
      if (inv >= 0) getSet(shopInv, shop).add(inv);
      if (hour >= 0) {
        add(getMap(shopHourRev, shop), hour, amt);
        if (inv >= 0) getSet(getMap(shopHourInv, shop), hour).add(inv);
      }
    }
    if (region) {
      add(regionRev, region, amt); add(regionQty, region, qty);
      if (hour >= 0) {
        add(getMap(regionHourRev, region), hour, amt);
        add(getMap(regionHourQty, region), hour, qty);
      }
    }
    if (prod) {
      add(prodRev, prod, amt); add(prodQty, prod, qty); add(prodWght, prod, wght);
      if (inv >= 0) getSet(prodInv, prod).add(inv);
      if (!prodMeta.has(prod)) prodMeta.set(prod, { seg: seg || "", cat: cat || "" });
    }
    if (cat) add(catRev, cat, amt);
    if (wd >= 0) add(wdRev, wd, amt);
  }

  const days = [...daysSet].sort();
  const hoursSorted = [...hourRev.keys()].sort((a, b) => a - b);

  const segsClean = [...segRev.entries()].filter(([k]) => k && k !== "#N/A");
  const segLabels = segsClean.map(([k]) => k);
  const totalRev = segsClean.reduce((a, [, v]) => a + v, 0);
  const totalQty = segLabels.reduce((a, s) => a + (segQty.get(s) || 0), 0);
  const totalWght = segLabels.reduce((a, s) => a + (segWght.get(s) || 0), 0);

  const regionLabels = [...regionRev.keys()];
  const regionData = regionLabels.map((r) => regionRev.get(r)!);
  const regionQtyArr = regionLabels.map((r) => regionQty.get(r) || 0);

  const regShops: Record<string, number> = {};
  for (const [shop, reg] of shopRegion) {
    if ((shopRev.get(shop) || 0) > 0) regShops[reg] = (regShops[reg] || 0) + 1;
  }

  const shopsFull: ShopRow[] = [...shopRev.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([shop, total]) => {
      const segMap = shopSegRev.get(shop) || new Map<string, number>();
      const w = shopWght.get(shop) || 0;
      const baskets = (shopInv.get(shop) || new Set()).size;
      return {
        shop, total,
        chicken: segMap.get("Chicken") || 0,
        beef: segMap.get("Beef") || 0,
        egg: segMap.get("Egg") || 0,
        trading: segMap.get("Trading") || 0,
        wght: w,
        mwk_per_kg: w ? total / w : 0,
        baskets,
        avg_basket: baskets ? total / baskets : 0,
      };
    });

  const productsFull: ProductRow[] = [...prodRev.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, rev]) => {
      const w = prodWght.get(p) || 0;
      const baskets = (prodInv.get(p) || new Set()).size;
      const meta = prodMeta.get(p) || { seg: "", cat: "" };
      return {
        name: p, rev,
        qty: prodQty.get(p) || 0,
        wght: w,
        mwk_per_kg: w ? rev / w : 0,
        baskets,
        avg_basket: baskets ? rev / baskets : 0,
        seg: meta.seg || "", cat: meta.cat || "",
        pct: totalRev ? (rev / totalRev) * 100 : 0,
      };
    });

  const region_hour: Record<string, { rev: number[]; qty: number[] }> = {};
  for (const reg of regionLabels) {
    const rvMap = regionHourRev.get(reg) || new Map<number, number>();
    const qtMap = regionHourQty.get(reg) || new Map<number, number>();
    region_hour[reg] = {
      rev: hoursSorted.map((h) => rvMap.get(h) || 0),
      qty: hoursSorted.map((h) => qtMap.get(h) || 0),
    };
  }

  const shop_hour = shopsFull.map((sr) => {
    const rvMap = shopHourRev.get(sr.shop) || new Map<number, number>();
    const invMap = shopHourInv.get(sr.shop) || new Map<number, Set<number>>();
    return {
      shop: sr.shop, total: sr.total,
      rev: hoursSorted.map((h) => rvMap.get(h) || 0),
      avg_basket: hoursSorted.map((h) => {
        const r = rvMap.get(h) || 0;
        const b = (invMap.get(h) || new Set()).size;
        return b ? r / b : 0;
      }),
    };
  });

  const topCats = [...catRev.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const wdKeys = [...wdRev.keys()].sort((a, b) => a - b);
  const totalBaskets = shopsFull.reduce((a, s) => a + s.baskets, 0);

  const months: MonthRow[] = (() => {
    const startMonth = startDate.slice(0, 7);
    const endMonth = endDate.slice(0, 7);
    const allMonths: string[] = [];
    let cur = startMonth;
    for (let guard = 0; guard < 60; guard++) {
      allMonths.push(cur);
      if (cur >= endMonth) break;
      const [y, m] = cur.split("-").map(Number);
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
    return allMonths.map((k) => {
      const rev = monthRev.get(k) || 0;
      const vol = monthVol.get(k) || 0;
      const ns = (monthShops.get(k) || new Set()).size;
      const nd = (monthDays.get(k) || new Set()).size;
      return {
        key: k,
        label: new Date(k + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" }),
        turnover: rev,
        volume: vol,
        n_shops: ns,
        n_days: nd,
        mwk_per_kg: vol ? rev / vol : 0,
        avg_daily_per_shop: ns && nd ? rev / (ns * nd) : 0,
      };
    });
  })();

  return {
    totals: {
      rev: totalRev, qty: totalQty, rows: nRows,
      n_days: days.length,
      n_shops: shopsFull.filter((s) => s.total > 0).length,
      wght: totalWght,
      nsv_per_kg: totalWght ? totalRev / totalWght : 0,
      baskets: totalBaskets,
    },
    segments: {
      labels: segLabels,
      data: segLabels.map((s) => segRev.get(s)!),
      qty: segLabels.map((s) => segQty.get(s) || 0),
      wght: segLabels.map((s) => segWght.get(s) || 0),
    },
    regions: {
      labels: regionLabels,
      data: regionData,
      qty: regionQtyArr,
      n_shops: regionLabels.map((r) => regShops[r] || 0),
      avg_per_shop: regionLabels.map((r) => (regShops[r] ? regionRev.get(r)! / regShops[r] : 0)),
    },
    days: {
      labels: days,
      rev: days.map((d) => dayRev.get(d) || 0),
      qty: days.map((d) => dayQty.get(d) || 0),
    },
    hours: {
      labels: hoursSorted.map((h) => String(h).padStart(2, "0") + ":00"),
      rev: hoursSorted.map((h) => hourRev.get(h) || 0),
      qty: hoursSorted.map((h) => hourQty.get(h) || 0),
    },
    weekdays: {
      labels: wdKeys.map((k) => WD_NAMES[k] || String(k)),
      rev: wdKeys.map((k) => wdRev.get(k) || 0),
    },
    cats: {
      labels: topCats.map((c) => c[0]),
      data: topCats.map((c) => c[1]),
    },
    shops: shopsFull,
    products: productsFull,
    region_hour,
    shop_hour,
    date_range: days.length ? `${days[0]} → ${days[days.length - 1]}` : "(no data)",
    months,
  };
}