import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/server";

// Initialize backend client with service role key to bypass RLS for uploads

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No Excel file provided." }, { status: 400 });
    }

    // Convert file to memory buffer
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    
    // Read the primary data sheet (assumed to be 'Data' sheet based on your Excel workbook)
    const sheetName = workbook.SheetNames.includes("Data") ? "Data" : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Parse sheet starting at the header row containing standard identifiers (usually row 2 in your layout)
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { range: 1 });

    if (rawData.length === 0) {
      return NextResponse.json({ error: "The uploaded data sheet is empty." }, { status: 400 });
    }

    // Map excel columns to database fields defined in public.retail_sales
    const rowsToInsert = rawData.map((row: any) => {
      
      const parseExcelDate = (val: any) => {
        if (!val) return null;
        if (typeof val === "number") {
          // Resolve serial integer representations of dates in Excel
          const date = new Date((val - 25569) * 86400 * 1000);
          return date.toISOString();
        }
        const parsed = new Date(val);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      };

      const parseTime = (val: any) => {
        if (!val) return null;
        if (typeof val === "number") {
          // Convert fraction of day back to hh:mm:ss
          const totalSeconds = Math.round(val * 24 * 3600);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        return String(val);
      };

      return {
        invoice_no: row["InvoiceNo"] ? String(row["InvoiceNo"]) : null,
        invoice_date: parseExcelDate(row["InvoiceDate"]),
        invoice_time: parseTime(row["InvoiceTime"]),
        sale_date: parseExcelDate(row["Date"]), // Maps to date column in DB
        customer_code: row["CustomerCode"] ? String(row["CustomerCode"]) : null,
        location_code: row["LocationCode"] ? String(row["LocationCode"]) : null,
        shop_name: row["ShopName"] ? String(row["ShopName"]) : null,
        shop_category: row["Shop Cat"] ? String(row["Shop Cat"]) : null,
        region: row["Region"] ? String(row["Region"]) : null,
        net_sale: row["NetSale"] ? parseFloat(row["NetSale"]) : null,
        product_code: row["ProductCode"] ? String(row["ProductCode"]) : null,
        product_name: row["ProductName"] ? String(row["ProductName"]) : null,
        segment: row["Segment"] ? String(row["Segment"]) : null,
        category: row["Category"] ? String(row["Category"]) : null,
        qty: row["Qty"] ? parseFloat(row["Qty"]) : null,
        weight: row["Wght"] ? parseFloat(row["Wght"]) : null,
        volume: row["Volume"] ? parseFloat(row["Volume"]) : null,
        unit_price: row["UnitPrice"] ? parseFloat(row["UnitPrice"]) : null,
        amount: row["Amount"] ? parseFloat(row["Amount"]) : null,
        tax_rate: row["TaxRate"] ? parseFloat(row["TaxRate"]) : null,
        tax_amount: row["TaxAmount"] ? parseFloat(row["TaxAmount"]) : null,
      };
    });

    // Chunk size limit to keep network transfers safe under database limits (e.g., 1000 rows per call)
    const CHUNK_SIZE = 1000;
    let insertedCount = 0;

    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from("retail_sales")
        .insert(chunk);

      if (error) {
        throw error;
      }
      insertedCount += chunk.length;
    }

    return NextResponse.json({
      success: true,
      message: `Parsed and inserted ${insertedCount} records to Supabase.`,
    });

  } catch (error: any) {
    console.error("Database ingestion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process database upload." },
      { status: 500 }
    );
  }
}