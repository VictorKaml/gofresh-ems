CREATE INDEX IF NOT EXISTS idx_retail_sales_date ON retail_sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_retail_sales_shop ON retail_sales (shop_name);
CREATE INDEX IF NOT EXISTS idx_retail_sales_segment ON retail_sales (segment);
CREATE INDEX IF NOT EXISTS idx_retail_sales_region ON retail_sales (region);