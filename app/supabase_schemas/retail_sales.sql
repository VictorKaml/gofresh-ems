-- Create the retail sales table
create table retail_sales (
    id bigint generated always as identity primary key,
    invoice_no text,
    invoice_date timestamp with time zone,
    invoice_time text,
    sale_date date,
    customer_code text,
    location_code text,
    shop_name text,
    shop_category text,
    region text,
    net_sale numeric(15, 2),
    product_code text,
    product_name text,
    segment text,
    category text,
    qty numeric(12, 3),
    weight numeric(12, 3),
    volume numeric(12, 3),
    unit_price numeric(15, 2),
    amount numeric(15, 2),
    tax_rate numeric(5, 2),
    tax_amount numeric(15, 2),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for lightning fast dashboard queries
create index idx_retail_sales_date on retail_sales(sale_date);
create index idx_retail_sales_shop_segment on retail_sales(shop_name, segment);
create index idx_retail_sales_product on retail_sales(product_name);