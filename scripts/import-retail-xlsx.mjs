#!/usr/bin/env node
/**
 * One-off / bulk importer for very large workbooks (e.g. the initial
 * ~700k-row, 100MB backfill). Reads straight off disk with ExcelJS'
 * streaming reader, so memory use stays flat regardless of file size.
 *
 * The web upload button (Upload Excel in the dashboard) is fine for regular,
 * smaller updates — reach for this script when a file is too big to
 * comfortably POST through your host's API route (body size / timeout
 * limits on serverless platforms).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/import-retail-xlsx.mjs path/to/file.xlsx [--replace]
 */
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const SHEET_NAME = "data all";
const BATCH_SIZE = 1000;

const HEADER_MAP = {
  InvoiceNo: "invoice_no",
  InvoiceDate: "invoice_date",
  InvoiceTime: "invoice_time",
  Date: "sale_date",
  Eomonth: "eomonth",
  Year: "year",
  Month: "month",
  Day: "day",
  Week: "week",
  Weekday: "weekday",
  Hour: "hour",
  CustomerCode: "customer_code",
  LocationCode: "location_code",
  ShopName: "shop_name",
  "Shop Cat": "shop_cat",
  Region: "region",
  NetSale: "net_sale",
  ProductCode: "product_code",
  ProductName: "product_name",
  Segment: "segment",
  Category: "category",
  Qty: "qty",
  Wght: "wght",
  Volume: "volume",
  UnitPrice: "unit_price",
  Amount: "amount",
  NSV: "nsv",
  TaxRate: "tax_rate",
  TaxAmount: "tax_amount",
};
const DATE_COLS = new Set(["invoice_date", "invoice_time", "sale_date", "eomonth"]);
const NUMBER_COLS = new Set([
  "year", "month", "day", "weekday", "hour", "net_sale", "qty", "wght",
  "volume", "unit_price", "amount", "nsv", "tax_rate", "tax_amount",
]);

async function main() {
  const filePath = process.argv[2];
  const replace = process.argv.includes("--replace");
  if (!filePath) {
    console.error("Usage: node scripts/import-retail-xlsx.mjs <file.xlsx> [--replace]");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (replace) {
    console.log("Clearing existing rows from retail_sales ...");
    const { error } = await supabase.from("retail_sales").delete().gt("id", 0);
    if (error) throw new Error(`Failed clearing table: ${error.message}`);
  }

  console.log(`Reading ${filePath} ...`);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(fs.createReadStream(filePath), {});

  let headerCols = [];
  let batch = [];
  let inserted = 0;
  let rowsSeen = 0;
  let sheetFound = false;
  const fileName = filePath.split(/[\\/]/).pop();

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase.from("retail_sales").insert(batch);
    if (error) throw new Error(`Insert failed near row ${rowsSeen}: ${error.message}`);
    inserted += batch.length;
    batch = [];
    process.stdout.write(`\r  inserted ${inserted.toLocaleString()} rows...`);
  }

  for await (const worksheetReader of reader) {
    if (!worksheetReader.name || worksheetReader.name.trim().toLowerCase() !== SHEET_NAME) continue;
    sheetFound = true;

    let rowNum = 0;
    for await (const row of worksheetReader) {
      rowNum++;
      const values = row.values;

      if (rowNum === 1) {
        headerCols = values.map((v) => (typeof v === "string" ? v.trim() : v));
        continue;
      }

      rowsSeen++;
      const record = { source_file: fileName };
      let hasAnyValue = false;

      for (let c = 1; c < values.length; c++) {
        const header = headerCols[c];
        if (!header) continue;
        const column = HEADER_MAP[header];
        if (!column) continue;

        let value = values[c];
        if (value === null || value === undefined || value === "") continue;
        hasAnyValue = true;

        if (DATE_COLS.has(column)) {
          record[column] = value instanceof Date ? value.toISOString() : value;
        } else if (NUMBER_COLS.has(column)) {
          const n = Number(value);
          record[column] = Number.isFinite(n) ? n : null;
        } else {
          record[column] = String(value);
        }
      }

      if (!hasAnyValue) continue;
      batch.push(record);
      if (batch.length >= BATCH_SIZE) await flush();
    }
  }
  await flush();

  console.log("");
  if (!sheetFound) {
    console.error(`Sheet "${SHEET_NAME}" not found in workbook.`);
    process.exit(1);
  }
  console.log(`Done. Rows seen: ${rowsSeen.toLocaleString()}, inserted: ${inserted.toLocaleString()}`);
}

main().catch((err) => {
  console.error("\nImport failed:", err.message);
  process.exit(1);
});
