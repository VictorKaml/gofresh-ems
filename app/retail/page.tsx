"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  ChartConfiguration,
  registerables,
} from "chart.js";

ChartJS.register(...registerables);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Totals {
  rev: number;
  qty: number;
  rows: number;
}
interface SegmentsData {
  labels: string[];
  data: number[];
  qty: number[];
}
interface RegionsData {
  labels: string[];
  data: number[];
  qty: number[];
}
interface DaysData {
  labels: string[];
  rev: number[];
  qty: number[];
}
interface HoursData {
  labels: string[];
  rev: number[];
  qty: number[];
}
interface WeekdaysData {
  labels: string[];
  rev: number[];
}
interface CatsData {
  labels: string[];
  data: number[];
}
interface Shop {
  shop: string;
  total: number;
  chicken: number;
  beef: number;
  egg: number;
  trading: number;
}
interface Product {
  name: string;
  rev: number;
  qty: number;
  seg: string;
  cat: string;
  pct?: number;
}
interface DashboardData {
  totals: Totals;
  segments: SegmentsData;
  regions: RegionsData;
  days: DaysData;
  hours: HoursData;
  weekdays: WeekdaysData;
  cats: CatsData;
  shops: Shop[];
  top_products: Product[];
  worst_products: Product[];
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const D: DashboardData = {
  totals: { rev: 487023797.1890003, qty: 97571.71399999986, rows: 33274 },
  segments: {
    labels: ["Beef", "Chicken", "Egg", "Trading"],
    data: [75753024.65000002, 395264164.2600003, 10519980.0, 5486628.279],
    qty: [19307.50899999998, 69662.59999999989, 924.0, 7677.605],
  },
  regions: {
    labels: ["North", "Southen", "Central"],
    data: [44344326.0, 114604884.91000004, 328259386.27900064],
    qty: [9466.799999999997, 20850.966, 67265.94799999992],
  },
  days: {
    labels: [
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
      "2026-05-04",
      "2026-05-05",
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
    ],
    rev: [
      59526840.21500005, 72478163.39, 42783446.20000003, 71007134.52000004,
      60056835.030000076, 60038001.35999996, 61264089.28399996,
      60054087.18999995,
    ],
    qty: [
      11424.361, 14061.133, 9035.690999999997, 15146.55099999998,
      12303.882999999974, 12093.063999999993, 12717.911, 10801.120000000006,
    ],
  },
  hours: {
    labels: [
      "00:00", "05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
      "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
      "20:00", "21:00", "22:00", "23:00",
    ],
    rev: [
      -619268.55, 13600.0, 489020.0, 2987355.0, 19779704.200000003,
      40179999.190000005, 45744650.859999985, 50121037.14, 52701057.99999997,
      37228595.37, 45304768.33399998, 52450411.24999999, 49906780.53,
      50772306.57000007, 23495008.234999996, 9033692.600000005,
      2644839.26, 1546108.5999999999, 1812847.9499999997, 1616082.6499999994,
    ],
    qty: [
      -120.465, 2.0, 169.0, 623.0, 4655.235, 8301.802, 9050.978999999998,
      9978.581999999995, 11444.676999999992, 7436.716999999998,
      8782.077000000005, 10546.951, 9614.07499999998, 9321.273,
      4219.588000000003, 1592.442000000001, 729.351, 365.62, 416.2200000000001,
      454.59,
    ],
  },
  weekdays: {
    labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    rev: [
      42783446.20000003, 71007134.52000004, 60056835.030000076,
      60038001.35999996, 61264089.28399996, 119580927.40499988,
      72478163.39,
    ],
  },
  cats: {
    labels: [
      "Frozen", "Fresh", "Value Added", "Eggs", "Bi-Product", "Water",
      "Kamba", "Biscuits", "Knaks", "Oil",
    ],
    data: [
      324673153.6, 79983016.01000004, 56758443.82000001, 10468000.0,
      9548871.4, 1658218.0, 858543.0, 821723.535, 600981.0, 555060.0,
    ],
  },
  shops: [
    { shop: "GFHM - Gofresh House of Meats", total: 99748446.629, chicken: 75051158.71999986, beef: 19423810.63000001, egg: 3915000.0, trading: 1358477.279 },
    { shop: "GFLK - GoFresh Likuni", total: 42374433.74999998, chicken: 32898478.19999998, beef: 8201231.549999998, egg: 448800.0, trading: 825924.0 },
    { shop: "GFKN - GoFresh Kanengo", total: 36789013.0, chicken: 30825100.0, beef: 5486420.0, egg: 276900.0, trading: 200593.0 },
    { shop: "GFL009 - HOUSE OF MEATS MCHINJI", total: 31233528.7, chicken: 25421554.0, beef: 5257010.7, egg: 151840.0, trading: 403124.0 },
    { shop: "GFL012 - House Meat Olympic Mall LLW", total: 25481897.669999983, chicken: 18746991.599999998, beef: 4982015.07, egg: 480000.0, trading: 1272891.0 },
    { shop: "GL010 - GL Lilongwe Area 3 Shop", total: 21471170.759999998, chicken: 19685425.12, beef: 1578351.64, egg: 150000.0, trading: 57394.0 },
    { shop: "GL012 - GL Kanengo Farm Shop", total: 18542450.0, chicken: 16299600.0, beef: 2242850.0, egg: 0, trading: 0 },
    { shop: "GFR004 - GF Area 49 Shop", total: 16657066.770000005, chicken: 12962175.020000001, beef: 3233750.749999999, egg: 285000.0, trading: 176141.0 },
    { shop: "GL009 - GL Zomba Shop", total: 14963816.0, chicken: 12788060.0, beef: 1983250.0, egg: 0, trading: 192506.0 },
    { shop: "GFL010 - KUTALI HOLDING", total: 14171750.0, chicken: 12027760.0, beef: 2063240.0, egg: 80750.0, trading: 0 },
    { shop: "GL002 - GL BAT shop", total: 14134631.199999997, chicken: 11924351.6, beef: 979944.6, egg: 1067300.0, trading: 132235.0 },
    { shop: "GFL017 - Mangochi Farm Shop", total: 11646230.0, chicken: 11404720.0, beef: 241510.0, egg: 0, trading: 0 },
    { shop: "GFL008 - HOUSE OF MEATS AREA 02", total: 11348639.0, chicken: 6615560.0, beef: 4733079.0, egg: 0, trading: 0 },
    { shop: "GL003 - GL Shire shop", total: 11015688.0, chicken: 10093800.0, beef: 394240.0, egg: 300000.0, trading: 212248.0 },
    { shop: "GL005 - GL Kulsum plaza shop", total: 10819796.400000004, chicken: 7994740.0, beef: 1814666.3999999994, egg: 917990.0, trading: 0 },
    { shop: "GFL015 - House of Meat Salima", total: 10440990.0, chicken: 8271700.0, beef: 2049290.0, egg: 120000.0, trading: 0 },
    { shop: "GFL016 - Mzuzu Farm Shop", total: 10351173.0, chicken: 8264480.0, beef: 1701450.0, egg: 0, trading: 385243.0 },
    { shop: "GFL005 - HOUSE OF MEATS MZUZU", total: 9737636.0, chicken: 8568140.0, beef: 1169496.0, egg: 0, trading: 0 },
    { shop: "GFMP - House of Meat Mpingwe", total: 8586090.0, chicken: 7708100.0, beef: 481090.0, egg: 396900.0, trading: 0 },
    { shop: "GFL021 - HOM Kasungu", total: 8504960.0, chicken: 6077220.0, beef: 2427740.0, egg: 0, trading: 0 },
    { shop: "GL001 - GL Blantyre shop", total: 8258957.0, chicken: 7132360.0, beef: 530330.0, egg: 555000.0, trading: 25867.0 },
    { shop: "GL011 - House of Meats Blantyre", total: 7427970.0, chicken: 6616940.0, beef: 251890.0, egg: 559140.0, trading: 0 },
    { shop: "GL004 - GL Iponga shop", total: 7001013.0, chicken: 5854240.0, beef: 487110.0, egg: 585000.0, trading: 74663.0 },
    { shop: "GFL018 - HOM Mzuzu City Shop", total: 6913948.0, chicken: 6082400.0, beef: 831548.0, egg: 0, trading: 0 },
    { shop: "GL006 - House of Meats Nyambadwe", total: 5624500.3100000005, chicken: 4196920.0, beef: 1224420.31, egg: 172360.0, trading: 0 },
    { shop: "GFL020 - HOM Katoto", total: 5589250.0, chicken: 5209280.0, beef: 321970.0, egg: 58000.0, trading: 0 },
    { shop: "GFL011 - House Of Meat Balaka", total: 4939510.0, chicken: 4402390.0, beef: 537120.0, egg: 0, trading: 0 },
    { shop: "GL008 - GL Tholo Farm Shop", total: 3741956.0, chicken: 3555480.0, beef: 75220.0, egg: 0, trading: 111256.0 },
    { shop: "GFL013 - House Meat Liwonde", total: 3421470.0, chicken: 3156900.0, beef: 264570.0, egg: 0, trading: 0 },
    { shop: "GFL006 - HOUSE OF MEATS MULANJE", total: 3247359.0, chicken: 2689200.0, beef: 517830.0, egg: 0, trading: 40329.0 },
    { shop: "GFL007 - Mangochi Shop", total: 3023257.0, chicken: 2738940.0, beef: 266580.0, egg: 0, trading: 17737.0 },
  ],
  top_products: [
    { name: "GF CKN Cutlets  1KG Tray", rev: 71399320.0, qty: 10499.9, seg: "Chicken", cat: "Frozen", pct: 14.660334959421279 },
    { name: "FF CKN Mixed Portion 1KG", rev: 51034000.0, qty: 6004.0, seg: "Chicken", cat: "Frozen", pct: 10.47874873765052 },
    { name: "FF CKN Fillet 500G", rev: 25762000.0, qty: 3454.0, seg: "Chicken", cat: "Frozen", pct: 5.289679918864927 },
    { name: "Hungarian Sausage Tray 400G", rev: 22937250.0, qty: 3855.0, seg: "Beef", cat: "Value Added", pct: 4.709677459785131 },
    { name: "GF CKN Claws 500G", rev: 22725500.0, qty: 6493.0, seg: "Chicken", cat: "Frozen", pct: 4.666199091536562 },
    { name: "GF CKN Heads  500G Tray", rev: 21853720.0, qty: 8512.0, seg: "Chicken", cat: "Frozen", pct: 4.487197571481129 },
    { name: "Chicken Drumsticks PKg", rev: 16281522.399999999, qty: 1010.0199999999999, seg: "Chicken", cat: "Fresh", pct: 3.3430650604700527 },
    { name: "Chicken Breast Fillet PKg", rev: 13207864.599999992, qty: 784.3149999999994, seg: "Chicken", cat: "Fresh", pct: 2.711954667561016 },
    { name: "GF Chicken Necks 500g", rev: 12673500.0, qty: 3621.0, seg: "Chicken", cat: "Frozen", pct: 2.602234238480501 },
    { name: "FF CKN Thigh 500G", rev: 12239500.0, qty: 3497.0, seg: "Chicken", cat: "Frozen", pct: 2.5131215498388046 },
    { name: "Chicken Wings PKg", rev: 12116833.680000005, qty: 649.3479999999997, seg: "Chicken", cat: "Fresh", pct: 2.4879346245370018 },
    { name: "Callisto 340G", rev: 10765440.0, qty: 3024.0, seg: "Beef", cat: "Value Added", pct: 2.2104546147715722 },
    { name: "CPX Eggs 30 pack", rev: 10468000.0, qty: 698.0, seg: "Egg", cat: "Eggs", pct: 2.1493816237356596 },
    { name: "GF CKN Liver 250G", rev: 8848800.0, qty: 4916.0, seg: "Chicken", cat: "Frozen", pct: 1.8169132701673771 },
    { name: "Bone 400 gram", rev: 8801900.0, qty: 8803.0, seg: "Beef", cat: "Bi-Product", pct: 1.807283350588355 },
  ],
  worst_products: [
    { name: "Munchy Crunch Periperi 50g x 20", rev: 464.0, qty: 2.0, seg: "Trading", cat: "Munchy" },
    { name: "MUNCHITOS BBQ 24gm", rev: 634.0, qty: 2.0, seg: "Trading", cat: "Chips" },
    { name: "Munchy Tomato 20G\u00a0(20Gms X 50 Pkt)", rev: 1160.0, qty: 5.0, seg: "Trading", cat: "Knaks" },
    { name: "MUNCHITOS 24 GRAM", rev: 1268.0, qty: 4.0, seg: "Trading", cat: "Chips" },
    { name: "GLUCO POWER(60*10PKT X 4)", rev: 1336.0, qty: 2.0, seg: "Trading", cat: "Biscuits" },
    { name: "Marie (150Gx10Pks)", rev: 1795.0, qty: 1.0, seg: "Trading", cat: "Biscuits" },
    { name: "Classic Creams Coconut 90G", rev: 2280.0, qty: 3.0, seg: "Trading", cat: "Biscuits" },
    { name: "Frooty Mix berry 330ML", rev: 2536.0, qty: 4.0, seg: "Trading", cat: "Frooty" },
    { name: "Frooty Passion 330ML", rev: 2536.0, qty: 4.0, seg: "Trading", cat: "Frooty" },
    { name: "Nyika Cordial Pineapple 2L", rev: 2960.0, qty: 1.0, seg: "Trading", cat: "Cordials" },
  ],
};

const PAL = [
  "#16a34a", "#dc2626", "#f59e0b", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#2563eb", "#ea580c", "#0d9488",
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const fmtM = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : Math.round(n).toString();

const PILL_CLASS: Record<string, string> = {
  Chicken: "chk",
  Beef: "bf",
  Egg: "eg",
  Trading: "tr",
};

const SegPill: React.FC<{ seg?: string }> = ({ seg }) => (
  <span className={`pill ${PILL_CLASS[seg || ""] || ""}`}>{seg || ""}</span>
);

/* ------------------------------------------------------------------ */
/* Generic Chart.js canvas wrapper                                     */
/* ------------------------------------------------------------------ */

const ChartCanvas: React.FC<{ config: ChartConfiguration }> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new ChartJS(canvasRef.current, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} />;
};

/* ------------------------------------------------------------------ */
/* Chart defaults                                                      */
/* ------------------------------------------------------------------ */

ChartJS.defaults.font.family = "-apple-system,'Segoe UI',Roboto,sans-serif";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = "#475569";

/* ------------------------------------------------------------------ */
/* Tabs configuration                                                  */
/* ------------------------------------------------------------------ */

const TABS = [
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
/* Panels                                                               */
/* ------------------------------------------------------------------ */

const OverviewPanel: React.FC = () => {
  const activeShops = D.shops.filter((s) => s.total > 0).length;

  return (
    <div className="panel active">
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value">{fmt(Math.round(D.totals.rev))} MWK</div>
          <div className="kpi-sub">8-day period</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Qty Sold</div>
          <div className="kpi-value">{fmt(D.totals.qty)} units</div>
          <div className="kpi-sub">All segments</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg Daily Revenue</div>
          <div className="kpi-value">{fmt(Math.round(D.totals.rev / 8))} MWK</div>
          <div className="kpi-sub">Across 8 days</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Transactions</div>
          <div className="kpi-value">{fmt(D.totals.rows)}</div>
          <div className="kpi-sub">Line items</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg Basket</div>
          <div className="kpi-value">{fmt(Math.round(D.totals.rev / D.totals.rows))} MWK</div>
          <div className="kpi-sub">Per line</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Active Shops</div>
          <div className="kpi-value">{activeShops}</div>
          <div className="kpi-sub">31 total</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3><span className="ico">📅</span> Daily Revenue Trend</h3>
          <div className="chart-box">
            <ChartCanvas
              config={{
                type: "line",
                data: {
                  labels: D.days.labels.map((d) => d.slice(5)),
                  datasets: [
                    {
                      label: "Revenue (MWK)",
                      data: D.days.rev,
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
                  scales: { y: { ticks: { callback: (v) => fmtM(Number(v)) } } },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3><span className="ico">🥧</span> Revenue by Segment</h3>
          <div className="chart-box">
            <ChartCanvas
              config={{
                type: "doughnut",
                data: {
                  labels: D.segments.labels,
                  datasets: [{ data: D.segments.data, backgroundColor: PAL }],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "right" },
                    tooltip: {
                      callbacks: {
                        label: (c) =>
                          c.label +
                          ": " +
                          fmt(Math.round(Number(c.parsed))) +
                          " MWK (" +
                          ((Number(c.parsed) / D.totals.rev) * 100).toFixed(1) +
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
          <h3><span className="ico">📆</span> Revenue by Weekday</h3>
          <div className="chart-box">
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels: D.weekdays.labels,
                  datasets: [{ label: "Revenue", data: D.weekdays.rev, backgroundColor: "#16a34a" }],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { ticks: { callback: (v) => fmtM(Number(v)) } } },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3><span className="ico">🌍</span> Revenue by Region</h3>
          <div className="chart-box">
            <ChartCanvas
              config={{
                type: "doughnut",
                data: {
                  labels: D.regions.labels,
                  datasets: [{ data: D.regions.data, backgroundColor: PAL }],
                },
                options: { maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const SegmentsPanel: React.FC = () => {
  const total = D.totals.rev;
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
                  labels: D.segments.labels,
                  datasets: [{ label: "Revenue (MWK)", data: D.segments.data, backgroundColor: PAL }],
                },
                options: {
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { ticks: { callback: (v) => fmtM(Number(v)) } } },
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
                  labels: D.cats.labels,
                  datasets: [{ label: "Revenue", data: D.cats.data, backgroundColor: "#0f766e" }],
                },
                options: {
                  maintainAspectRatio: false,
                  indexAxis: "y",
                  plugins: { legend: { display: false } },
                  scales: { x: { ticks: { callback: (v) => fmtM(Number(v)) } } },
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
              <th className="num">% Share</th>
              <th className="num">Avg Price</th>
            </tr>
          </thead>
          <tbody>
            {D.segments.labels.map((s, i) => {
              const r = D.segments.data[i];
              const q = D.segments.qty[i];
              return (
                <tr key={s}>
                  <td><SegPill seg={s} /></td>
                  <td className="num">{fmt(Math.round(r))}</td>
                  <td className="num">{fmt(q)}</td>
                  <td className="num">{((r / total) * 100).toFixed(1)}%</td>
                  <td className="num">{fmt(Math.round(r / q))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

type ShopSortKey = "total" | "chicken" | "beef" | "egg" | "trading";

const ShopsPanel: React.FC = () => {
  const [sortKey, setSortKey] = useState<ShopSortKey>("total");
  const [search, setSearch] = useState("");

  const top15 = D.shops.slice(0, 15);

  const filtered = D.shops
    .filter((s) => s.shop.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="panel active">
      <div className="filter-row">
        <label>Sort by:</label>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as ShopSortKey)}>
          <option value="total">Total Revenue</option>
          <option value="chicken">Chicken Revenue</option>
          <option value="beef">Beef Revenue</option>
          <option value="egg">Egg Revenue</option>
          <option value="trading">Trading Revenue</option>
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
        <h3>Top 15 Shops by Revenue</h3>
        <div className="chart-box tall">
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: top15.map((s) => (s.shop.length > 30 ? s.shop.slice(0, 30) + "…" : s.shop)),
                datasets: [{ label: "Revenue", data: top15.map((s) => s.total), backgroundColor: "#16a34a" }],
              },
              options: {
                maintainAspectRatio: false,
                indexAxis: "y",
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { callback: (v) => fmtM(Number(v)) } } },
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.shop}>
                <td><span className="rank">{i + 1}</span></td>
                <td>{s.shop}</td>
                <td className="num">{fmt(Math.round(s.total))}</td>
                <td className="num">{fmt(Math.round(s.chicken))}</td>
                <td className="num">{fmt(Math.round(s.beef))}</td>
                <td className="num">{fmt(Math.round(s.egg))}</td>
                <td className="num">{fmt(Math.round(s.trading))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MEDALS = ["🥇", "🥈", "🥉"];

const ProductsPanel: React.FC = () => {
  const [seg, setSeg] = useState("");
  const [q, setQ] = useState("");

  const top = D.top_products.filter(
    (p) => (!seg || p.seg === seg) && p.name.toLowerCase().includes(q.toLowerCase())
  );
  const worst = D.worst_products.filter(
    (p) => (!seg || p.seg === seg) && p.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="panel active">
      <div className="filter-row">
        <label>Filter segment:</label>
        <select value={seg} onChange={(e) => setSeg(e.target.value)}>
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="card">
        <h3>🏆 Top 15 Products by Revenue</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Segment</th>
              <th>Category</th>
              <th className="num">Revenue (MWK)</th>
              <th className="num">Qty</th>
              <th className="num">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p, i) => (
              <tr key={p.name}>
                <td><span className="rank">{MEDALS[i] || "#" + (i + 1)}</span></td>
                <td>{p.name}</td>
                <td><SegPill seg={p.seg} /></td>
                <td>{p.cat || ""}</td>
                <td className="num">{fmt(Math.round(p.rev))}</td>
                <td className="num">{fmt(p.qty)}</td>
                <td className="num">{(p.pct ?? 0).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>⚠️ Worst 10 Products by Revenue (sold but low value)</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Segment</th>
              <th>Category</th>
              <th className="num">Revenue</th>
              <th className="num">Qty</th>
            </tr>
          </thead>
          <tbody>
            {worst.map((p, i) => (
              <tr key={p.name}>
                <td>{i + 1}</td>
                <td>{p.name}</td>
                <td><SegPill seg={p.seg} /></td>
                <td>{p.cat || ""}</td>
                <td className="num">{fmt(Math.round(p.rev))}</td>
                <td className="num">{fmt(p.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TimePanel: React.FC = () => (
  <div className="panel active">
    <div className="insight">
      💡 Peak selling hour is around midday (12:00). Roughly 65% of revenue comes between 09:00 and 17:00.
    </div>
    <div className="grid2">
      <div className="card">
        <h3>Hourly Revenue Pattern</h3>
        <div className="chart-box tall">
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: D.hours.labels,
                datasets: [{ label: "Revenue", data: D.hours.rev, backgroundColor: "#16a34a" }],
              },
              options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { ticks: { callback: (v) => fmtM(Number(v)) } } },
              },
            }}
          />
        </div>
      </div>
      <div className="card">
        <h3>Hourly Volume Pattern</h3>
        <div className="chart-box tall">
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: D.hours.labels,
                datasets: [{ label: "Qty", data: D.hours.qty, backgroundColor: "#0891b2" }],
              },
              options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
            }}
          />
        </div>
      </div>
    </div>
    <div className="card">
      <h3>Daily Revenue &amp; Quantity</h3>
      <div className="chart-box tall">
        <ChartCanvas
          config={{
            type: "bar",
            data: {
              labels: D.days.labels,
              datasets: [
                {
                  label: "Revenue (MWK)",
                  data: D.days.rev,
                  backgroundColor: "#16a34a",
                  yAxisID: "y",
                },
                {
                  type: "line",
                  label: "Quantity",
                  data: D.days.qty,
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
                y: { position: "left", ticks: { callback: (v) => fmtM(Number(v)) } },
                y1: { position: "right", grid: { display: false } },
              },
            },
          }}
        />
      </div>
    </div>
  </div>
);

const RegionsPanel: React.FC = () => {
  const t = D.totals.rev;
  return (
    <div className="panel active">
      <div className="grid2">
        <div className="card">
          <h3>Revenue by Region</h3>
          <div className="chart-box tall">
            <ChartCanvas
              config={{
                type: "pie",
                data: { labels: D.regions.labels, datasets: [{ data: D.regions.data, backgroundColor: PAL }] },
                options: { maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
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
                data: { labels: D.regions.labels, datasets: [{ data: D.regions.qty, backgroundColor: PAL }] },
                options: { maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
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
              <th className="num">Revenue (MWK)</th>
              <th className="num">Qty</th>
              <th className="num">% Share</th>
            </tr>
          </thead>
          <tbody>
            {D.regions.labels.map((r, i) => {
              const rev = D.regions.data[i];
              const q = D.regions.qty[i];
              return (
                <tr key={r}>
                  <td>{r}</td>
                  <td className="num">{fmt(Math.round(rev))}</td>
                  <td className="num">{fmt(q)}</td>
                  <td className="num">{((rev / t) * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DataPanel: React.FC = () => (
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
          {D.days.labels.map((d, i) => (
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
          {D.hours.labels.map((h, i) => (
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
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="gf-dashboard">
      <style>{`
        .gf-dashboard * { box-sizing: border-box; margin: 0; padding: 0; }
        .gf-dashboard {
          font-family: -apple-system,'Segoe UI',Roboto,sans-serif;
          background: #f4f6f8;
          color: #1f2937;
          line-height: 1.4;
          min-height: 100vh;
        }
        .gf-dashboard header {
          background: linear-gradient(135deg,#16a34a 0%,#0f766e 100%);
          color: #fff;
          padding: 20px 28px;
          box-shadow: 0 2px 8px rgba(0,0,0,.1);
        }
        .gf-dashboard header h1 { font-size: 22px; font-weight: 700; letter-spacing: -.3px; }
        .gf-dashboard header .sub { font-size: 12px; opacity: .85; margin-top: 4px; }
        .gf-dashboard .container { max-width: 1400px; margin: 0 auto; padding: 20px 24px; }
        .gf-dashboard .tabs {
          display: flex; gap: 4px; background: #fff; padding: 6px; border-radius: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 20px; flex-wrap: wrap;
        }
        .gf-dashboard .tab {
          padding: 9px 18px; border: 0; background: transparent; cursor: pointer;
          font-size: 13px; font-weight: 500; color: #64748b; border-radius: 7px; transition: all .15s;
        }
        .gf-dashboard .tab:hover { background: #f1f5f9; color: #0f172a; }
        .gf-dashboard .tab.active { background: #16a34a; color: #fff; font-weight: 600; }
        .gf-dashboard .panel { display: none; }
        .gf-dashboard .panel.active { display: block; animation: gf-fade .25s ease-in; }
        @keyframes gf-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .gf-dashboard .kpi-grid {
          display: grid; grid-template-columns: repeat(auto-fit,minmax(190px,1fr)); gap: 14px; margin-bottom: 20px;
        }
        .gf-dashboard .kpi {
          background: #fff; padding: 16px 18px; border-radius: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,.06); border-left: 4px solid #16a34a;
        }
        .gf-dashboard .kpi.beef { border-left-color: #b91c1c; }
        .gf-dashboard .kpi.egg { border-left-color: #f59e0b; }
        .gf-dashboard .kpi.trading { border-left-color: #7c3aed; }
        .gf-dashboard .kpi-label {
          font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; margin-bottom: 6px;
        }
        .gf-dashboard .kpi-value { font-size: 22px; font-weight: 700; color: #0f172a; }
        .gf-dashboard .kpi-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
        .gf-dashboard .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
        .gf-dashboard .grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 18px; }
        @media (max-width: 900px) {
          .gf-dashboard .grid2, .gf-dashboard .grid3 { grid-template-columns: 1fr; }
        }
        .gf-dashboard .card { background: #fff; border-radius: 10px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
        .gf-dashboard .card h3 {
          font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
        }
        .gf-dashboard .card h3 .ico { font-size: 14px; }
        .gf-dashboard .chart-box { position: relative; height: 280px; }
        .gf-dashboard .chart-box.tall { height: 340px; }
        .gf-dashboard table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .gf-dashboard th {
          text-align: left; padding: 8px 10px; background: #f8fafc; color: #475569; font-weight: 600;
          font-size: 11px; text-transform: uppercase; letter-spacing: .3px; border-bottom: 1px solid #e2e8f0;
        }
        .gf-dashboard td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
        .gf-dashboard tr:hover td { background: #f8fafc; }
        .gf-dashboard .num { text-align: right; font-variant-numeric: tabular-nums; }
        .gf-dashboard .pill {
          display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px;
          font-weight: 600; text-transform: uppercase; letter-spacing: .3px;
        }
        .gf-dashboard .pill.chk { background: #dcfce7; color: #15803d; }
        .gf-dashboard .pill.bf { background: #fee2e2; color: #b91c1c; }
        .gf-dashboard .pill.eg { background: #fef3c7; color: #b45309; }
        .gf-dashboard .pill.tr { background: #ede9fe; color: #6d28d9; }
        .gf-dashboard .filter-row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
        .gf-dashboard .filter-row label { font-size: 12px; color: #475569; font-weight: 500; }
        .gf-dashboard select, .gf-dashboard input {
          padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; background: #fff; font-family: inherit;
        }
        .gf-dashboard select:focus, .gf-dashboard input:focus {
          outline: 0; border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,.15);
        }
        .gf-dashboard .footer { text-align: center; padding: 30px 0 20px; color: #94a3b8; font-size: 11px; }
        .gf-dashboard .badge {
          display: inline-block; background: #16a34a; color: #fff; font-size: 10px; padding: 2px 8px;
          border-radius: 10px; font-weight: 600; margin-left: 6px;
        }
        .gf-dashboard .rank { font-size: 14px; font-weight: 700; color: #16a34a; width: 28px; display: inline-block; }
        .gf-dashboard .insight {
          background: #f0fdf4; border-left: 3px solid #16a34a; padding: 10px 14px; margin-bottom: 14px;
          font-size: 12px; color: #15803d; border-radius: 6px;
        }
        .gf-dashboard .warn { background: #fef3c7; border-left-color: #f59e0b; color: #92400e; }
      `}</style>

      <header>
        <h1>🛒 GoFresh RetailMax — Sales Intelligence Dashboard</h1>
        <div className="sub">
          2026-May-01 → 2026-May-08 · 33,274 transactions · 31 shops · 220 SKUs · 3 regions · 4 segments
        </div>
      </header>

      <div className="container">
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

        {tab === "overview" && <OverviewPanel />}
        {tab === "segments" && <SegmentsPanel />}
        {tab === "shops" && <ShopsPanel />}
        {tab === "products" && <ProductsPanel />}
        {tab === "time" && <TimePanel />}
        {tab === "regions" && <RegionsPanel />}
        {tab === "data" && <DataPanel />}

        <div className="footer">
          GoFresh RetailMax Sales Intelligence · Generated from GoFresh_RetailMax_Sales_sheet_Pankaj_update.xlsx · Open in any modern browser (Chrome, Edge, Safari, Firefox)
        </div>
      </div>
    </div>
  );
};

export default GoFreshSalesDashboard;
