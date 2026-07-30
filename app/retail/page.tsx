"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chart as ChartJS, registerables } from "chart.js";
import { supabase } from "@/lib/supabase/client";

ChartJS.register(...registerables);

/* ------------------------------------------------------------------ */
/* Types — aligned to SQL get_dashboard_summary() output               */
/* ------------------------------------------------------------------ */

interface MonthData {
  key: string;
  label: string;
  turnover: number;
  volume: number;
  n_shops: number;
  n_days: number;
  mwk_per_kg: number;
  avg_daily_per_shop: number;
}

interface ShopData {
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

interface ProductData {
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

interface RegionHourData {
  rev: number[];
  qty: number[];
}

interface ShopHourData {
  shop: string;
  total: number;
  rev: number[];
  avg_basket: number[];
}

interface DashboardData {
  date_range: string;
  totals: {
    rev: number;
    qty: number;
    rows: number;
    baskets: number;
    n_days: number;
    n_shops: number;
    wght: number;
    nsv_per_kg: number;
  };
  months: MonthData[];
  days: {
    labels: string[];
    rev: number[];
    qty: number[];
  };
  weekdays: {
    labels: string[];
    rev: number[];
  };
  hours: {
    labels: string[];
    rev: number[];
    qty: number[];
  };
  segments: {
    labels: string[];
    data: number[];
    qty: number[];
    wght: number[];
  };
  cats: {
    labels: string[];
    data: number[];
  };
  shops: ShopData[];
  products: ProductData[];
  regions: {
    labels: string[];
    data: number[];
    qty: number[];
    n_shops: number[];
    avg_per_shop: number[];
  };
  region_hour: Record<string, RegionHourData>;
  shop_hour: ShopHourData[];
}

/* ------------------------------------------------------------------ */
/* Constants / helpers                                                 */
/* ------------------------------------------------------------------ */

const PAL = [
  "#16a34a", "#dc2626", "#f59e0b", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#2563eb", "#ea580c", "#0d9488",
];
const REGION_COLORS: Record<string, string> = {
  Central: "#16a34a", Southern: "#dc2626", Southen: "#dc2626", South: "#dc2626",
  North: "#f59e0b", Northern: "#f59e0b",
};

const regionColor = (r: string, regionKeys: string[]) =>
  REGION_COLORS[r] || PAL[Math.max(0, regionKeys.indexOf(r)) % PAL.length];

const fmt = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtM = (n: number) =>
  n >= 1e6
    ? (n / 1e6).toFixed(1) + "M"
    : n >= 1e3
    ? (n / 1e3).toFixed(0) + "K"
    : Math.round(n).toString();

const PILL_CLASS: Record<string, string> = {
  Chicken: "chk",
  Beef: "bf",
  Egg: "eg",
  Trading: "tr",
};
const SegPill: React.FC<{ seg?: string }> = ({ seg }) => (
  <span className={`pill ${PILL_CLASS[seg || ""] || ""}`}>{seg || ""}</span>
);

const doughnutPctLabels = {
  id: "doughnutPctLabels",
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const values = chart.data.datasets[0].data as number[];
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return;
    meta.data.forEach((arc: any, i: number) => {
      const pct = (values[i] / total) * 100;
      if (pct < 3) return;
      const { x, y } = arc.getCenterPoint();
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px -apple-system,Segoe UI,Roboto,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 3;
      ctx.fillText(pct.toFixed(1) + "%", x, y);
      ctx.restore();
    });
  },
};

ChartJS.defaults.font.family = "-apple-system,'Segoe UI',Roboto,sans-serif";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = "#475569";

/* ------------------------------------------------------------------ */
/* Chart wrapper                                                       */
/* ------------------------------------------------------------------ */

const ChartCanvas: React.FC<{ config: any }> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    chartRef.current = new ChartJS(canvasRef.current, config);
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return <canvas ref={canvasRef} />;
};

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "exec", label: "🏢 Executive" },
  { key: "overview", label: "📊 Overview" },
  { key: "segments", label: "🍗 Segments" },
  { key: "shops", label: "🏪 Shops" },
  { key: "products", label: "🏆 Products" },
  { key: "time", label: "🕐 Time Patterns" },
  { key: "regions", label: "🌍 Regions" },
  { key: "data", label: "📋 Raw Tables" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

const ExecutivePanel: React.FC<{ D: DashboardData }> = ({ D }) => {
  const M = D.months || [];
  const sumRev = M.reduce((a, m) => a + m.turnover, 0);
  const sumVol = M.reduce((a, m) => a + m.volume, 0);
  const sumShopDays = M.reduce((a, m) => a + m.n_shops * m.n_days, 0);
  const labels = M.map((m) => m.label);
  const barOpts = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: (v: any) => fmtM(Number(v)) } } },
  };
  const lineOpts = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v: any) => fmtM(Number(v)) } },
    },
  };

  return (
    <div className="panel active">
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Months in view</div>
          <div className="kpi-value">{M.length}</div>
          <div className="kpi-sub">
            {M.length
              ? M[0].label + (M.length > 1 ? ` → ${M[M.length - 1].label}` : "")
              : "(no data)"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Turnover</div>
          <div className="kpi-value">{fmt(Math.round(sumRev))} MWK</div>
          <div className="kpi-sub">Across period</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Volume</div>
          <div className="kpi-value">{fmt(Math.round(sumVol))} kg</div>
          <div className="kpi-sub">kg sold</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "#0f766e" }}>
          <div className="kpi-label">Avg NSV / KG</div>
          <div className="kpi-value">
            {fmt(sumVol ? Math.round(sumRev / sumVol) : 0)} MWK
          </div>
          <div className="kpi-sub">Turnover ÷ Volume</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "#7c3aed" }}>
          <div className="kpi-label">Avg Daily / Shop</div>
          <div className="kpi-value">
            {fmt(sumShopDays ? Math.round(sumRev / sumShopDays) : 0)} MWK
          </div>
          <div className="kpi-sub">Blended, weighted by shop-days</div>
        </div>
      </div>

      <div className="card">
        <h3>📊 Monthly Performance Summary</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th className="num"># Shops</th>
              <th className="num">Active Days</th>
              <th className="num">Volume (kg)</th>
              <th className="num">Turnover (MWK)</th>
              <th className="num">MWK / kg (NSV)</th>
              <th className="num">Avg Daily / Shop</th>
            </tr>
          </thead>
          <tbody>
            {M.map((m) => (
              <tr key={m.key}>
                <td>
                  <strong>{m.label}</strong>
                </td>
                <td className="num">{fmt(m.n_shops)}</td>
                <td className="num">{fmt(m.n_days)}</td>
                <td className="num">{fmt(Math.round(m.volume))}</td>
                <td className="num">{fmt(Math.round(m.turnover))}</td>
                <td className="num">{fmt(Math.round(m.mwk_per_kg))}</td>
                <td className="num">
                  {fmt(Math.round(m.avg_daily_per_shop))}
                </td>
              </tr>
            ))}
            <tr
              style={{
                background: "#f0fdf4",
                fontWeight: 700,
                borderTop: "2px solid #16a34a",
              }}
            >
              <td>
                <strong>TOTAL</strong>
              </td>
              <td className="num">
                {M.length ? Math.max(...M.map((m) => m.n_shops)) : 0}{" "}
                <span
                  style={{
                    fontWeight: 400,
                    color: "#64748b",
                    fontSize: 10,
                  }}
                >
                  (peak)
                </span>
              </td>
              <td className="num">
                {fmt(M.reduce((a, m) => a + m.n_days, 0))}
              </td>
              <td className="num">{fmt(Math.round(sumVol))}</td>
              <td className="num">{fmt(Math.round(sumRev))}</td>
              <td className="num">
                {fmt(sumVol ? Math.round(sumRev / sumVol) : 0)}
              </td>
              <td className="num">
                {fmt(sumShopDays ? Math.round(sumRev / sumShopDays) : 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>💰 Turnover per Month</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels,
                  datasets: [
                    {
                      data: M.map((m) => m.turnover),
                      backgroundColor: "#16a34a",
                    },
                  ],
                },
                options: barOpts,
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3>⚖️ Volume per Month (kg)</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels,
                  datasets: [
                    {
                      data: M.map((m) => m.volume),
                      backgroundColor: "#0891b2",
                    },
                  ],
                },
                options: barOpts,
              }}
            />
          </div>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>🎯 Price per KG (NSV) — Monthly Trend</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "line",
                data: {
                  labels,
                  datasets: [
                    {
                      data: M.map((m) => m.mwk_per_kg),
                      borderColor: "#0f766e",
                      backgroundColor: "rgba(15,118,110,.12)",
                      tension: 0.3,
                      fill: true,
                      pointRadius: 5,
                      borderWidth: 2,
                    },
                  ],
                },
                options: {
                  ...lineOpts,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (c: any) =>
                          fmt(Math.round(c.parsed.y)) + " MWK / kg",
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3>🏪 Avg Daily Sales per Shop — Monthly Trend</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "line",
                data: {
                  labels,
                  datasets: [
                    {
                      data: M.map((m) => m.avg_daily_per_shop),
                      borderColor: "#7c3aed",
                      backgroundColor: "rgba(124,58,237,.12)",
                      tension: 0.3,
                      fill: true,
                      pointRadius: 5,
                      borderWidth: 2,
                    },
                  ],
                },
                options: {
                  ...lineOpts,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (c: any) =>
                          fmt(Math.round(c.parsed.y)) + " MWK / shop / day",
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="card">
        <h3>🏬 Active Shops per Month</h3>
        <div className="chart-box">
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels,
                datasets: [
                  {
                    data: M.map((m) => m.n_shops),
                    backgroundColor: "#f59e0b",
                  },
                ],
              },
              options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

const OverviewPanel: React.FC<{ D: DashboardData }> = ({ D }) => (
  <div className="panel active">
    <div className="kpi-grid">
      <div className="kpi">
        <div className="kpi-label">Total Revenue</div>
        <div className="kpi-value">
          {fmt(Math.round(D.totals.rev))} MWK
        </div>
        <div className="kpi-sub">{D.totals.n_days}-day period</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Total Qty Sold</div>
        <div className="kpi-value">{fmt(D.totals.qty)} units</div>
        <div className="kpi-sub">All segments</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Avg Daily Revenue</div>
        <div className="kpi-value">
          {fmt(Math.round(D.totals.rev / Math.max(D.totals.n_days, 1)))} MWK
        </div>
        <div className="kpi-sub">Across {D.totals.n_days} days</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Transactions</div>
        <div className="kpi-value">{fmt(D.totals.rows)}</div>
        <div className="kpi-sub">Line items</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Avg Basket</div>
        <div className="kpi-value">
          {fmt(Math.round(D.totals.rev / Math.max(D.totals.rows, 1)))} MWK
        </div>
        <div className="kpi-sub">Per line</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Active Shops</div>
        <div className="kpi-value">{D.totals.n_shops}</div>
        <div className="kpi-sub">With revenue</div>
      </div>
      <div className="kpi" style={{ borderLeftColor: "#0f766e" }}>
        <div className="kpi-label">Avg NSV / KG</div>
        <div className="kpi-value">
          {fmt(Math.round(D.totals.nsv_per_kg))} MWK
        </div>
        <div className="kpi-sub">
          On {fmt(Math.round(D.totals.wght))} kg volume
        </div>
      </div>
    </div>

    <div className="grid2">
      <div className="card">
        <h3>📅 Daily Revenue Trend</h3>
        <div className="chart-box">
          <ChartCanvas
            config={{
              type: "line",
              data: {
                labels: (D.days?.labels || []).map((d) => d.slice(5)),
                datasets: [
                  {
                    label: "Revenue (MWK)",
                    data: D.days?.rev || [],
                    borderColor: "#16a34a",
                    backgroundColor: "rgba(22,163,74,.1)",
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: "#16a34a",
                    pointRadius: 4,
                  },
                ],
              },
              options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { ticks: { callback: (v: any) => fmtM(Number(v)) } },
                },
              },
            }}
          />
        </div>
      </div>
      <div className="card">
        <h3>🥧 Revenue by Segment</h3>
        <div className="chart-box">
          <ChartCanvas
            config={{
              type: "doughnut",
              data: {
                labels: D.segments?.labels || [],
                datasets: [
                  {
                    data: D.segments?.data || [],
                    backgroundColor: PAL,
                    borderWidth: 2,
                    borderColor: "#fff",
                  },
                ],
              },
              plugins: [doughnutPctLabels],
              options: {
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "right" },
                  tooltip: {
                    callbacks: {
                      label: (c: any) =>
                        c.label +
                        ": " +
                        fmt(Math.round(Number(c.parsed))) +
                        " MWK (" +
                        (D.totals.rev
                          ? ((Number(c.parsed) / D.totals.rev) * 100).toFixed(
                              1
                            )
                          : "0.0") +
                        "%)",
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>

    <div className="grid2">
      <div className="card">
        <h3>📆 Revenue by Weekday</h3>
        <div className="chart-box">
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: D.weekdays?.labels || [],
                datasets: [
                  {
                    data: D.weekdays?.rev || [],
                    backgroundColor: "#16a34a",
                  },
                ],
              },
              options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { ticks: { callback: (v: any) => fmtM(Number(v)) } },
                },
              },
            }}
          />
        </div>
      </div>
      <div className="card">
        <h3>🌍 Revenue by Region</h3>
        <div className="chart-box">
          <ChartCanvas
            config={{
              type: "doughnut",
              data: {
                labels: D.regions?.labels || [],
                datasets: [
                  {
                    data: D.regions?.data || [],
                    backgroundColor: PAL,
                  },
                ],
              },
              options: {
                maintainAspectRatio: false,
                plugins: { legend: { position: "right" } },
              },
            }}
          />
        </div>
      </div>
    </div>
  </div>
);

const SegmentsPanel: React.FC<{ D: DashboardData }> = ({ D }) => {
  const total = D.totals.rev;
  const segRows = D.segments?.labels.map((s, i) => {
    const r = D.segments.data[i],
      q = D.segments.qty[i],
      w = D.segments.wght[i];
    return (
      <tr key={s}>
        <td>
          <SegPill seg={s} />
        </td>
        <td className="num">{fmt(Math.round(r))}</td>
        <td className="num">{fmt(q)}</td>
        <td className="num">{fmt(Math.round(w))}</td>
        <td className="num">{total ? (r / total * 100).toFixed(1) : "0.0"}%</td>
        <td className="num">{q ? fmt(Math.round(r / q)) : "-"}</td>
        <td className="num">{w ? fmt(Math.round(r / w)) : "-"}</td>
      </tr>
    );
  });

  const sumR = D.segments?.data.reduce((a, b) => a + b, 0) || 0;
  const sumQ = D.segments?.qty.reduce((a, b) => a + b, 0) || 0;
  const sumW = D.segments?.wght.reduce((a, b) => a + b, 0) || 0;

  return (
    <div className="panel active">
      <div className="grid2">
        <div className="card">
          <h3>Segment Revenue Share</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels: D.segments?.labels || [],
                  datasets: [
                    {
                      label: "Revenue (MWK)",
                      data: D.segments?.data || [],
                      backgroundColor: PAL,
                    },
                  ],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { ticks: { callback: (v: any) => fmtM(Number(v)) } },
                  },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3>Top 10 Categories by Revenue</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels: D.cats?.labels || [],
                  datasets: [
                    {
                      label: "Revenue",
                      data: D.cats?.data || [],
                      backgroundColor: "#0f766e",
                    },
                  ],
                },
                options: {
                  maintainAspectRatio: false,
                  indexAxis: "y",
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { callback: (v: any) => fmtM(Number(v)) } },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Segment Performance Table</h3>
        <table>
          <thead>
            <tr>
              <th>Segment</th>
              <th className="num">Revenue (MWK)</th>
              <th className="num">Qty</th>
              <th className="num">Volume (kg)</th>
              <th className="num">% Share</th>
              <th className="num">Avg Price / Unit</th>
              <th className="num">MWK / kg (NSV)</th>
            </tr>
          </thead>
          <tbody>
            {segRows}
            <tr
              style={{
                background: "#f0fdf4",
                fontWeight: 700,
                borderTop: "2px solid #16a34a",
              }}
            >
              <td>
                <strong>TOTAL</strong>
              </td>
              <td className="num">{fmt(Math.round(sumR))}</td>
              <td className="num">{fmt(sumQ)}</td>
              <td className="num">{fmt(Math.round(sumW))}</td>
              <td className="num">100.0%</td>
              <td className="num">
                {sumQ ? fmt(Math.round(sumR / sumQ)) : "-"}
              </td>
              <td className="num">
                {sumW ? fmt(Math.round(sumR / sumW)) : "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

type ShopSortKey = "total" | "chicken" | "beef" | "egg" | "trading" | "mwk_per_kg" | "avg_basket";
const ShopsPanel: React.FC<{ D: DashboardData }> = ({ D }) => {
  const [sortKey, setSortKey] = useState<ShopSortKey>("total");
  const [search, setSearch] = useState("");

  const shopsSorted = useMemo(
    () => [...(D.shops || [])].sort((a, b) => b.total - a.total),
    [D]
  );
  const filtered = useMemo(
    () =>
      (D.shops || [])
        .filter((s) => s.shop.toLowerCase().includes(search.toLowerCase()))
        .slice()
        .sort(
          (a, b) => (b[sortKey] as number) - (a[sortKey] as number)
        ),
    [D, sortKey, search]
  );

  return (
    <div className="panel active">
      <div className="filter-row">
        <label>Sort by:</label>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as ShopSortKey)}
        >
          <option value="total">Total Revenue</option>
          <option value="chicken">Chicken Revenue</option>
          <option value="beef">Beef Revenue</option>
          <option value="egg">Egg Revenue</option>
          <option value="trading">Trading Revenue</option>
          <option value="mwk_per_kg">Avg Price / kg</option>
          <option value="avg_basket">Avg Basket Size</option>
        </select>
        <label>Search:</label>
        <input
          placeholder="Type shop name…"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="card">
        <h3>All Shops by Revenue — Stacked by Segment</h3>
        <div style={{ position: "relative", height: 780 }}>
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: shopsSorted.map((s) => s.shop),
                datasets: [
                  {
                    label: "Chicken",
                    data: shopsSorted.map((s) => s.chicken),
                    backgroundColor: "#16a34a",
                    stack: "s",
                  },
                  {
                    label: "Beef",
                    data: shopsSorted.map((s) => s.beef),
                    backgroundColor: "#dc2626",
                    stack: "s",
                  },
                  {
                    label: "Egg",
                    data: shopsSorted.map((s) => s.egg),
                    backgroundColor: "#f59e0b",
                    stack: "s",
                  },
                  {
                    label: "Trading",
                    data: shopsSorted.map((s) => s.trading),
                    backgroundColor: "#7c3aed",
                    stack: "s",
                  },
                ],
              },
              options: {
                maintainAspectRatio: false,
                indexAxis: "y",
                plugins: {
                  legend: { position: "top" },
                  tooltip: {
                    callbacks: {
                      label: (c: any) =>
                        c.dataset.label +
                        ": " +
                        fmt(Math.round(c.parsed.x)) +
                        " MWK",
                      footer: (items: any[]) => {
                        const t = items.reduce(
                          (a, i) => a + i.parsed.x,
                          0
                        );
                        return "Total: " + fmt(Math.round(t)) + " MWK";
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    stacked: true,
                    ticks: { callback: (v: any) => fmtM(Number(v)) },
                  },
                  y: {
                    stacked: true,
                    ticks: { font: { size: 10 }, autoSkip: false },
                  },
                },
              },
            }}
          />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Shop Performance — Full Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Shop</th>
              <th className="num">Total</th>
              <th className="num">Chicken</th>
              <th className="num">Beef</th>
              <th className="num">Egg</th>
              <th className="num">Trading</th>
              <th className="num">MWK / kg</th>
              <th className="num">Avg Basket</th>
              <th className="num">Baskets</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.shop}>
                <td>
                  <span className="rank">{i + 1}</span>
                </td>
                <td>{s.shop}</td>
                <td className="num">{fmt(Math.round(s.total))}</td>
                <td className="num">{fmt(Math.round(s.chicken))}</td>
                <td className="num">{fmt(Math.round(s.beef))}</td>
                <td className="num">{fmt(Math.round(s.egg))}</td>
                <td className="num">{fmt(Math.round(s.trading))}</td>
                <td className="num">
                  {s.mwk_per_kg ? fmt(Math.round(s.mwk_per_kg)) : "-"}
                </td>
                <td className="num">
                  {s.avg_basket ? fmt(Math.round(s.avg_basket)) : "-"}
                </td>
                <td className="num">{fmt(s.baskets)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

type ProdSortKey = "rev" | "qty" | "wght" | "mwk_per_kg" | "avg_basket" | "baskets";
const ProductsPanel: React.FC<{ D: DashboardData }> = ({ D }) => {
  const [sortKey, setSortKey] = useState<ProdSortKey>("rev");
  const [segFilter, setSegFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let arr = (D.products || []).filter(
      (p) =>
        (!segFilter || p.seg === segFilter) &&
        p.name.toLowerCase().includes(search.toLowerCase())
    );
    arr.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    return arr;
  }, [D, sortKey, segFilter, search]);

  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="panel active">
      <div className="filter-row">
        <label>Sort by:</label>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as ProdSortKey)}
        >
          <option value="rev">Revenue (highest)</option>
          <option value="qty">Quantity</option>
          <option value="wght">Volume (kg)</option>
          <option value="mwk_per_kg">Avg Price / kg</option>
          <option value="avg_basket">Avg Basket Size</option>
          <option value="baskets">Baskets</option>
        </select>
        <label>Filter segment:</label>
        <select
          value={segFilter}
          onChange={(e) => setSegFilter(e.target.value)}
        >
          <option value="">All</option>
          <option>Chicken</option>
          <option>Beef</option>
          <option>Egg</option>
          <option>Trading</option>
        </select>
        <label>Search:</label>
        <input
          placeholder="Product name…"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="card">
        <h3>
          🏆 All Products by Revenue{" "}
          <span
            style={{
              fontWeight: 400,
              color: "#64748b",
              marginLeft: 8,
            }}
          >
            — showing {filtered.length} of {D.products?.length || 0} products
          </span>
        </h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Segment</th>
              <th>Category</th>
              <th className="num">Revenue (MWK)</th>
              <th className="num">Qty</th>
              <th className="num">Volume (kg)</th>
              <th className="num">MWK / kg</th>
              <th className="num">Avg Basket</th>
              <th className="num">Baskets</th>
              <th className="num">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.name}>
                <td>
                  <span className="rank">{medals[i] || "#" + (i + 1)}</span>
                </td>
                <td>{p.name}</td>
                <td>
                  <SegPill seg={p.seg} />
                </td>
                <td>{p.cat || ""}</td>
                <td className="num">{fmt(Math.round(p.rev))}</td>
                <td className="num">{fmt(p.qty)}</td>
                <td className="num">
                  {p.wght ? fmt(Math.round(p.wght)) : "-"}
                </td>
                <td className="num">
                  {p.mwk_per_kg ? fmt(Math.round(p.mwk_per_kg)) : "-"}
                </td>
                <td className="num">
                  {p.avg_basket ? fmt(Math.round(p.avg_basket)) : "-"}
                </td>
                <td className="num">{fmt(p.baskets)}</td>
                <td className="num">{p.pct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TimePanel: React.FC<{ D: DashboardData }> = ({ D }) => {
  const regionKeys = Object.keys(D.region_hour || {});
  const hourlyRevDatasets = regionKeys.map((r) => ({
    label: r,
    data: D.region_hour[r].rev,
    borderColor: regionColor(r, regionKeys),
    backgroundColor: regionColor(r, regionKeys) + "22",
    tension: 0.3,
    fill: false,
    pointRadius: 3,
    borderWidth: 2,
  }));
  const hourlyQtyDatasets = regionKeys.map((r) => ({
    label: r,
    data: D.region_hour[r].qty,
    borderColor: regionColor(r, regionKeys),
    backgroundColor: regionColor(r, regionKeys) + "22",
    tension: 0.3,
    fill: false,
    pointRadius: 3,
    borderWidth: 2,
  }));

  return (
    <div className="panel active">
      <div className="insight">
        💡 Peak selling hour is typically around midday. Most revenue is
        generated between 09:00 and 17:00. Region overlays reveal where each
        area's rhythm differs.
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Hourly Revenue Pattern — by Region</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "line",
                data: {
                  labels: D.hours?.labels || [],
                  datasets: hourlyRevDatasets,
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "top" },
                    tooltip: {
                      callbacks: {
                        label: (c: any) =>
                          c.dataset.label +
                          ": " +
                          fmt(Math.round(c.parsed.y)) +
                          " MWK",
                      },
                    },
                  },
                  scales: {
                    y: {
                      ticks: { callback: (v: any) => fmtM(Number(v)) },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3>Hourly Volume Pattern — by Region</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "line",
                data: {
                  labels: D.hours?.labels || [],
                  datasets: hourlyQtyDatasets,
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "top" },
                    tooltip: {
                      callbacks: {
                        label: (c: any) =>
                          c.dataset.label +
                          ": " +
                          fmt(Math.round(c.parsed.y)) +
                          " units",
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Daily Revenue & Quantity</h3>
        <div className="chart-box tall">
          <ChartCanvas
            config={{
              data: {
                labels: D.days?.labels || [],
                datasets: [
                  {
                    type: "bar",
                    label: "Revenue (MWK)",
                    data: D.days?.rev || [],
                    backgroundColor: "#16a34a",
                    yAxisID: "y",
                  },
                  {
                    type: "line",
                    label: "Quantity",
                    data: D.days?.qty || [],
                    borderColor: "#dc2626",
                    backgroundColor: "#dc2626",
                    yAxisID: "y1",
                    tension: 0.3,
                  },
                ],
              },
              options: {
                maintainAspectRatio: false,
                scales: {
                  y: {
                    position: "left",
                    ticks: { callback: (v: any) => fmtM(Number(v)) },
                  },
                  y1: { position: "right", grid: { display: false } },
                },
              },
            }}
          />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>
          Hourly Pattern per Shop — Revenue (bars) + Avg Basket Size (line)
        </h3>
        <div
          style={{
            fontSize: 11,
            color: "#64748b",
            marginBottom: 10,
          }}
        >
          All shops, sorted by total revenue. Green bars = MWK revenue per hour.
          Orange line = avg basket size (MWK per unique invoice) that hour.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          {(D.shop_hour || []).map((s, i) => (
            <div
              key={s.shop}
              style={{
                background: "#fafafa",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#0f172a",
                  marginBottom: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={s.shop}
              >
                {s.shop}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Total: {fmt(Math.round(s.total))} MWK
              </div>
              <div style={{ position: "relative", height: 150 }}>
                <ChartCanvas
                  config={{
                    data: {
                      labels: D.hours?.labels || [],
                      datasets: [
                        {
                          type: "bar",
                          label: "Revenue",
                          data: s.rev,
                          backgroundColor: "#16a34a",
                          yAxisID: "y",
                          order: 2,
                        },
                        {
                          type: "line",
                          label: "Avg Basket",
                          data: s.avg_basket,
                          borderColor: "#f59e0b",
                          backgroundColor: "#f59e0b",
                          yAxisID: "y1",
                          tension: 0.3,
                          pointRadius: 2,
                          borderWidth: 2,
                          order: 1,
                          spanGaps: true,
                        },
                      ],
                    },
                    options: {
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (c: any) =>
                              c.dataset.label +
                              ": " +
                              fmt(Math.round(c.parsed.y)) +
                              " MWK",
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            font: { size: 8 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                          },
                        },
                        y: {
                          position: "left",
                          ticks: {
                            font: { size: 9 },
                            callback: (v: any) => fmtM(Number(v)),
                          },
                        },
                        y1: {
                          position: "right",
                          grid: { display: false },
                          ticks: {
                            font: { size: 9 },
                            callback: (v: any) => fmtM(Number(v)),
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RegionsPanel: React.FC<{ D: DashboardData }> = ({ D }) => {
  const t = D.totals.rev;
  const sumR = D.regions?.data.reduce((a, b) => a + b, 0) || 0;
  const sumQ = D.regions?.qty.reduce((a, b) => a + b, 0) || 0;
  const sumS = D.regions?.n_shops.reduce((a, b) => a + b, 0) || 0;

  return (
    <div className="panel active">
      <div className="grid2">
        <div className="card">
          <h3>Revenue by Region</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "pie",
                data: {
                  labels: D.regions?.labels || [],
                  datasets: [
                    {
                      data: D.regions?.data || [],
                      backgroundColor: PAL,
                    },
                  ],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3>Quantity by Region</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "pie",
                data: {
                  labels: D.regions?.labels || [],
                  datasets: [
                    {
                      data: D.regions?.qty || [],
                      backgroundColor: PAL,
                    },
                  ],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Region Performance</h3>
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th className="num"># Shops</th>
              <th className="num">Revenue (MWK)</th>
              <th className="num">Qty</th>
              <th className="num">Avg Sales / Shop</th>
              <th className="num">% Share</th>
            </tr>
          </thead>
          <tbody>
            {D.regions?.labels.map((r, i) => {
              const rev = D.regions.data[i];
              const q = D.regions.qty[i];
              const ns = D.regions.n_shops[i];
              const ap = D.regions.avg_per_shop[i];
              return (
                <tr key={r}>
                  <td>
                    <strong>{r}</strong>
                  </td>
                  <td className="num">{fmt(ns)}</td>
                  <td className="num">{fmt(Math.round(rev))}</td>
                  <td className="num">{fmt(q)}</td>
                  <td className="num">{fmt(Math.round(ap))}</td>
                  <td className="num">
                    {t ? (rev / t * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              );
            })}
            <tr
              style={{
                background: "#f0fdf4",
                fontWeight: 700,
                borderTop: "2px solid #16a34a",
              }}
            >
              <td>
                <strong>TOTAL</strong>
              </td>
              <td className="num">{fmt(sumS)}</td>
              <td className="num">{fmt(Math.round(sumR))}</td>
              <td className="num">{fmt(sumQ)}</td>
              <td className="num">
                {sumS ? fmt(Math.round(sumR / sumS)) : "-"}
              </td>
              <td className="num">100.0%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DataPanel: React.FC<{ D: DashboardData }> = ({ D }) => (
  <div className="panel active">
    <div className="card">
      <h3>Daily Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="num">Revenue (MWK)</th>
            <th className="num">Qty</th>
          </tr>
        </thead>
        <tbody>
          {D.days?.labels.map((d, i) => (
            <tr key={d}>
              <td>{d}</td>
              <td className="num">{fmt(Math.round(D.days.rev[i]))}</td>
              <td className="num">{fmt(D.days.qty[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Hourly Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Hour</th>
            <th className="num">Revenue (MWK)</th>
            <th className="num">Qty</th>
          </tr>
        </thead>
        <tbody>
          {D.hours?.labels.map((h, i) => (
            <tr key={h}>
              <td>{h}</td>
              <td className="num">{fmt(Math.round(D.hours.rev[i]))}</td>
              <td className="num">{fmt(D.hours.qty[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Root component                                                      */
/* ------------------------------------------------------------------ */

const GoFreshSalesDashboard: React.FC = () => {
  const [tab, setTab] = useState<TabKey>("exec");
  const [D, setD] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replaceOnUpload, setReplaceOnUpload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_start_date: dateStart || null,
        p_end_date: dateEnd || null,
      });

      if (error) throw new Error(error.message);
      setD(data as DashboardData);
    } catch (err: any) {
      setLoadError(
        err?.message || "Failed to load aggregated dataset from Supabase"
      );
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  function onDateChange(newStart: string, newEnd: string) {
    let s = newStart,
      e = newEnd;
    if (s && e && s > e) {
      const t = s;
      s = e;
      e = t;
    }
    setDateStart(s);
    setDateEnd(e);
  }

  function handleReset() {
    setDateStart("");
    setDateEnd("");
  }

  function setQuickRange(days: number) {
    if (!D) return;
    const allDates = D.days?.labels || [];
    if (!allDates.length) return;
    const end = allDates[allDates.length - 1];
    const start = allDates[Math.max(0, allDates.length - days)];
    setDateStart(start);
    setDateEnd(end);
  }

  async function handleFileSelected(file: File) {
    setUploading(true);
    setUploadMsg(null);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("replace", String(replaceOnUpload));
      const res = await fetch("/api/upload-retail", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setUploadMsg(json.message || `Inserted ${json.inserted} rows.`);
      await fetchSummary();
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="gf-dashboard">
      <style>{`
        .gf-dashboard * { box-sizing: border-box; margin: 0; padding: 0; }
        .gf-dashboard { font-family: -apple-system,'Segoe UI',Roboto,sans-serif; background: #f4f6f8; color: #1f2937; line-height: 1.4; min-height: 100vh; }
        .gf-dashboard header { background: linear-gradient(135deg,#16a34a 0%,#0f766e 100%); color: #fff; padding: 20px 28px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        .gf-dashboard header h1 { font-size: 22px; font-weight: 700; letter-spacing: -.3px; }
        .gf-dashboard header .sub { font-size: 12px; opacity: .85; margin-top: 4px; }
        .gf-dashboard header .hdr-actions { margin-top: 12px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .gf-dashboard .upload-btn { background: #fff; color: #0f766e; border: 0; padding: 8px 16px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .gf-dashboard .upload-btn:disabled { opacity: .6; cursor: not-allowed; }
        .gf-dashboard .hdr-actions label { font-size: 11px; color: #fff; opacity: .9; display: flex; align-items: center; gap: 4px; }
        .gf-dashboard .container { max-width: 1400px; margin: 0 auto; padding: 20px 24px; }
        .gf-dashboard .banner { padding: 10px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 14px; }
        .gf-dashboard .banner.info { background: #eff6ff; color: #1d4ed8; }
        .gf-dashboard .banner.success { background: #f0fdf4; color: #15803d; }
        .gf-dashboard .banner.error { background: #fef2f2; color: #b91c1c; }
        .gf-dashboard .tabs { display: flex; gap: 4px; background: #fff; padding: 6px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 20px; flex-wrap: wrap; }
        .gf-dashboard .tab { padding: 9px 18px; border: 0; background: transparent; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748b; border-radius: 7px; transition: all .15s; }
        .gf-dashboard .tab:hover { background: #f1f5f9; color: #0f172a; }
        .gf-dashboard .tab.active { background: #16a34a; color: #fff; font-weight: 600; }
        .gf-dashboard .panel { display: none; }
        .gf-dashboard .panel.active { display: block; animation: gf-fade .25s ease-in; }
        @keyframes gf-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .gf-dashboard .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(190px,1fr)); gap: 14px; margin-bottom: 20px; }
        .gf-dashboard .kpi { background: #fff; padding: 16px 18px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.06); border-left: 4px solid #16a34a; }
        .gf-dashboard .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; margin-bottom: 6px; }
        .gf-dashboard .kpi-value { font-size: 22px; font-weight: 700; color: #0f172a; }
        .gf-dashboard .kpi-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
        .gf-dashboard .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
        @media (max-width: 900px) { .gf-dashboard .grid2 { grid-template-columns: 1fr; } }
        .gf-dashboard .card { background: #fff; border-radius: 10px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
        .gf-dashboard .card h3 { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .gf-dashboard .chart-box { position: relative; height: 280px; }
        .gf-dashboard .chart-box.tall { height: 340px; }
        .gf-dashboard table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .gf-dashboard th { text-align: left; padding: 8px 10px; background: #f8fafc; color: #475569; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; border-bottom: 1px solid #e2e8f0; }
        .gf-dashboard td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
        .gf-dashboard tr:hover td { background: #f8fafc; }
        .gf-dashboard .num { text-align: right; font-variant-numeric: tabular-nums; }
        .gf-dashboard .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
        .gf-dashboard .pill.chk { background: #dcfce7; color: #15803d; }
        .gf-dashboard .pill.bf { background: #fee2e2; color: #b91c1c; }
        .gf-dashboard .pill.eg { background: #fef3c7; color: #b45309; }
        .gf-dashboard .pill.tr { background: #ede9fe; color: #6d28d9; }
        .gf-dashboard .filter-row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
        .gf-dashboard .filter-row label { font-size: 12px; color: #475569; font-weight: 500; }
        .gf-dashboard select, .gf-dashboard input { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; background: #fff; font-family: inherit; }
        .gf-dashboard select:focus, .gf-dashboard input:focus { outline: 0; border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,.15); }
        .gf-dashboard .filter-bar { background: #fff; padding: 14px 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); border-radius: 10px; margin-bottom: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
        .gf-dashboard .reset-btn { padding: 6px 12px; border: 1px solid #16a34a; background: #16a34a; color: #fff; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 500; }
        .gf-dashboard .quick-btn { padding: 6px 12px; border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; font-size: 11px; cursor: pointer; }
        .gf-dashboard .footer { text-align: center; padding: 30px 0 20px; color: #94a3b8; font-size: 11px; }
        .gf-dashboard .rank { font-size: 14px; font-weight: 700; color: #16a34a; width: 28px; display: inline-block; }
        .gf-dashboard .insight { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 10px 14px; margin-bottom: 14px; font-size: 12px; color: #15803d; border-radius: 6px; }
      `}</style>

      <header>
        <h1>🛒 GoFresh RetailMax — Sales Intelligence Dashboard</h1>
        <div className="sub">
          {D
            ? `${D.date_range} · ${fmt(D.totals.rows)} transactions · ${
                D.totals.n_shops
              } shops · ${D.totals.n_days} days`
            : loading
            ? "Calculating summaries in Supabase…"
            : "No data loaded"}
        </div>
        <div className="hdr-actions">
          <button
            className="upload-btn"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "📤 Upload Excel"}
          </button>
          <label>
            <input
              type="checkbox"
              checked={replaceOnUpload}
              onChange={(e) => setReplaceOnUpload(e.target.checked)}
            />
            Replace existing data
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
            }}
          />
        </div>
      </header>

      <div className="container">
        {uploadMsg && <div className="banner success">{uploadMsg}</div>}
        {uploadError && (
          <div className="banner error">Upload failed: {uploadError}</div>
        )}
        {loadError && (
          <div className="banner error">
            Couldn&rsquo;t load data: {loadError} —{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                fetchSummary();
              }}
            >
              retry
            </a>
          </div>
        )}
        {loading && (
          <div className="banner info">Querying database aggregations…</div>
        )}

        {D && (
          <>
            <div className="filter-bar">
              <span
                style={{
                  fontWeight: 600,
                  color: "#0f172a",
                  fontSize: 13,
                }}
              >
                📅 Date range:
              </span>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => onDateChange(e.target.value, dateEnd)}
              />
              <span style={{ color: "#64748b" }}>to</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => onDateChange(dateStart, e.target.value)}
              />
              <button className="quick-btn" onClick={() => setQuickRange(1)}>
                Last 1 day
              </button>
              <button className="quick-btn" onClick={() => setQuickRange(3)}>
                Last 3 days
              </button>
              <button className="quick-btn" onClick={() => setQuickRange(7)}>
                Last 7 days
              </button>
              <button className="reset-btn" onClick={handleReset}>
                Reset (all)
              </button>
              <span
                style={{
                  color: "#16a34a",
                  fontWeight: 500,
                  fontSize: 12,
                  marginLeft: "auto",
                }}
              >
                Showing {D.totals.n_days} day(s) · {fmt(D.totals.rows)} rows ·{" "}
                {fmt(Math.round(D.totals.rev))} MWK
              </span>
            </div>

            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "exec" && <ExecutivePanel D={D} />}
            {tab === "overview" && <OverviewPanel D={D} />}
            {tab === "segments" && <SegmentsPanel D={D} />}
            {tab === "shops" && <ShopsPanel D={D} />}
            {tab === "products" && <ProductsPanel D={D} />}
            {tab === "time" && <TimePanel D={D} />}
            {tab === "regions" && <RegionsPanel D={D} />}
            {tab === "data" && <DataPanel D={D} />}
          </>
        )}

        <div className="footer">
          GoFresh RetailMax Sales Intelligence · Live from Supabase (retail_sales)
        </div>
      </div>
    </div>
  );
};

export default GoFreshSalesDashboard;