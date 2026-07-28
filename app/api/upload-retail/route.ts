import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const SHEET_NAME = "data all";
const BATCH_SIZE = 500;

const HEADER_MAP: Record<string, string> = {
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

/**
 * Converts Excel serial dates (e.g. 45688), Date objects, or string representations
 * into valid ISO 8601 strings for PostgreSQL.
 */
function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  const num = Number(value);
  if (!isNaN(num) && num > 1000) {
    // 25569 = Days between 1899-12-30 and 1970-01-01
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString();
  }

  return String(value);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const replace = form.get("replace") === "true";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded (expected field 'file')" }, { status: 400 });
  }

  const supabase = await createClient();

  if (replace) {
    const { error: delErr } = await supabase.from("retail_sales").delete().gt("id", 0);
    if (delErr) {
      return NextResponse.json({ error: `Failed clearing existing data: ${delErr.message}` }, { status: 500 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { Readable } = await import("stream");
  const stream = Readable.from(buffer);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {});

  let headerCols: (string | undefined)[] = [];
  let batch: Record<string, unknown>[] = [];
  let totalInserted = 0;
  let rowsSeen = 0;
  let sheetFound = false;

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase.from("retail_sales").insert(batch);
    if (error) throw new Error(`Insert failed at row ~${rowsSeen}: ${error.message}`);
    totalInserted += batch.length;
    batch = [];
  }

  try {
    for await (const worksheetReader of reader) {
      const name = (worksheetReader as any).name as string | undefined;
      if (!name || name.trim().toLowerCase() !== SHEET_NAME) continue;
      sheetFound = true;

      let rowNum = 0;
      for await (const row of worksheetReader) {
        rowNum++;
        const values = row.values as any[];

        if (rowNum === 1) {
          headerCols = values.map((v) => (typeof v === "string" ? v.trim() : v));
          continue;
        }

        rowsSeen++;
        const record: Record<string, unknown> = { source_file: (file as File).name };
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
            // FIX: Safely parse numbers (e.g. 45688) into valid ISO dates
            record[column] = parseExcelDate(value);
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed while parsing/inserting the workbook", inserted: totalInserted },
      { status: 500 }
    );
  }

  if (!sheetFound) {
    return NextResponse.json(
      { error: `Sheet "${SHEET_NAME}" not found in the uploaded workbook.` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: `Inserted ${totalInserted.toLocaleString()} rows from "${SHEET_NAME}".`,
    inserted: totalInserted,
    rowsSeen,
    replaced: replace,
  });
}