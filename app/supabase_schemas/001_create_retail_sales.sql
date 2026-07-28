-- GoFresh RetailMax : retail_sales table
-- Matches the columns of the "data all" sheet in gofresh_retailmax.xlsx
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

create table if not exists public.retail_sales (
  id              bigint generated always as identity primary key,

  invoice_no      text,
  invoice_date    timestamptz,
  invoice_time    timestamptz,
  sale_date       date,          -- "Date" column
  eomonth         date,
  year            int,
  month           int,
  day             int,
  week            text,          -- e.g. "202501" (kept as text, has leading structure not a plain int)
  weekday         int,
  hour            int,

  customer_code   text,
  location_code   text,
  shop_name       text,
  shop_cat        text,
  region          text,

  net_sale        numeric,
  product_code    text,
  product_name    text,
  segment         text,
  category        text,

  qty             numeric,
  wght            numeric,
  volume          numeric,
  unit_price      numeric,
  amount          numeric,
  nsv             numeric,
  tax_rate        numeric,
  tax_amount      numeric,

  -- bookkeeping
  source_file     text,
  uploaded_at     timestamptz not null default now()
);

-- Indexes for the filters/aggregations the dashboard needs
create index if not exists retail_sales_sale_date_idx  on public.retail_sales (sale_date);
create index if not exists retail_sales_shop_name_idx  on public.retail_sales (shop_name);
create index if not exists retail_sales_segment_idx    on public.retail_sales (segment);
create index if not exists retail_sales_category_idx   on public.retail_sales (category);
create index if not exists retail_sales_region_idx      on public.retail_sales (region);
create index if not exists retail_sales_product_code_idx on public.retail_sales (product_code);
create index if not exists retail_sales_invoice_no_idx  on public.retail_sales (invoice_no);

-- Row Level Security
-- The upload route uses the SERVICE ROLE key (bypasses RLS), so this just
-- locks down access for the anon/authenticated keys used by the browser.
alter table public.retail_sales enable row level security;

-- Example read-only policy for logged-in users of the dashboard.
-- Adjust/remove to match your actual auth setup.
drop policy if exists "Authenticated users can read retail_sales" on public.retail_sales;
create policy "Authenticated users can read retail_sales"
  on public.retail_sales
  for select
  to authenticated
  using (true);