-- 1. Temporarily increase script timeout for execution window
SET statement_timeout = '120s';

-- 2. Create optimized aggregation function
CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_start_date date DEFAULT NULL, 
  p_end_date date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'date_range', (
      SELECT concat(COALESCE(MIN(sale_date)::text, ''), ' to ', COALESCE(MAX(sale_date)::text, ''))
      FROM retail_sales
      WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
        AND (p_end_date IS NULL OR sale_date <= p_end_date)
    ),
    'totals', (
      SELECT json_build_object(
        'rows', COUNT(*),
        'rev', COALESCE(SUM(amount), 0),
        'qty', COALESCE(SUM(qty), 0),
        'wght', COALESCE(SUM(wght), 0),
        'n_shops', COUNT(DISTINCT shop_name),
        'n_days', COUNT(DISTINCT sale_date),
        'nsv_per_kg', CASE WHEN SUM(wght) > 0 THEN SUM(amount) / SUM(wght) ELSE 0 END
      )
      FROM retail_sales
      WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
        AND (p_end_date IS NULL OR sale_date <= p_end_date)
    ),
    'months', (
      SELECT COALESCE(json_agg(m), '[]'::json)
      FROM (
        SELECT 
          to_char(sale_date, 'YYYY-MM') as key,
          to_char(sale_date, 'Mon YYYY') as label,
          COUNT(DISTINCT shop_name) as n_shops,
          COUNT(DISTINCT sale_date) as n_days,
          COALESCE(SUM(wght), 0) as volume,
          COALESCE(SUM(amount), 0) as turnover,
          CASE WHEN SUM(wght) > 0 THEN SUM(amount) / SUM(wght) ELSE 0 END as mwk_per_kg,
          CASE WHEN COUNT(DISTINCT shop_name) * COUNT(DISTINCT sale_date) > 0 
               THEN SUM(amount) / (COUNT(DISTINCT shop_name) * COUNT(DISTINCT sale_date)) 
               ELSE 0 END as avg_daily_per_shop
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY 1, 2
        ORDER BY 1 ASC
      ) m
    ),
    'days', (
      SELECT json_build_object(
        'labels', COALESCE(json_agg(d.dt), '[]'::json),
        'rev', COALESCE(json_agg(d.rev), '[]'::json),
        'qty', COALESCE(json_agg(d.qty), '[]'::json)
      )
      FROM (
        SELECT sale_date::text as dt, SUM(amount) as rev, SUM(qty) as qty
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY sale_date
        ORDER BY sale_date ASC
      ) d
    ),
    'weekdays', (
      SELECT json_build_object(
        'labels', json_build_array('Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'),
        'rev', json_build_array(
          COALESCE(SUM(CASE WHEN weekday = 1 THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN weekday = 2 THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN weekday = 3 THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN weekday = 4 THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN weekday = 5 THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN weekday = 6 THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN weekday = 7 THEN amount ELSE 0 END), 0)
        )
      )
      FROM retail_sales
      WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
        AND (p_end_date IS NULL OR sale_date <= p_end_date)
    ),
    'hours', (
      SELECT json_build_object(
        'labels', COALESCE(json_agg(h.hr_label), '[]'::json),
        'rev', COALESCE(json_agg(h.rev), '[]'::json),
        'qty', COALESCE(json_agg(h.qty), '[]'::json)
      )
      FROM (
        SELECT 
          concat(lpad(hour::text, 2, '0'), ':00') as hr_label, 
          SUM(amount) as rev, 
          SUM(qty) as qty
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY hour
        ORDER BY hour ASC
      ) h
    ),
    'segments', (
      SELECT json_build_object(
        'labels', COALESCE(json_agg(s.segment), '[]'::json),
        'data', COALESCE(json_agg(s.rev), '[]'::json),
        'qty', COALESCE(json_agg(s.qty), '[]'::json),
        'wght', COALESCE(json_agg(s.wght), '[]'::json)
      )
      FROM (
        SELECT COALESCE(segment, 'Uncategorized') as segment, SUM(amount) as rev, SUM(qty) as qty, SUM(wght) as wght
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY 1
        ORDER BY rev DESC
      ) s
    ),
    'cats', (
      SELECT json_build_object(
        'labels', COALESCE(json_agg(c.category), '[]'::json),
        'data', COALESCE(json_agg(c.rev), '[]'::json)
      )
      FROM (
        SELECT COALESCE(category, 'Other') as category, SUM(amount) as rev
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY 1
        ORDER BY rev DESC
        LIMIT 10
      ) c
    ),
    'shops', (
      SELECT COALESCE(json_agg(sh), '[]'::json)
      FROM (
        SELECT 
          shop_name as shop,
          SUM(amount) as total,
          SUM(CASE WHEN segment = 'Chicken' THEN amount ELSE 0 END) as chicken,
          SUM(CASE WHEN segment = 'Beef' THEN amount ELSE 0 END) as beef,
          SUM(CASE WHEN segment = 'Egg' THEN amount ELSE 0 END) as egg,
          SUM(CASE WHEN segment = 'Trading' THEN amount ELSE 0 END) as trading,
          CASE WHEN SUM(wght) > 0 THEN SUM(amount) / SUM(wght) ELSE 0 END as mwk_per_kg,
          COUNT(DISTINCT invoice_no) as baskets,
          CASE WHEN COUNT(DISTINCT invoice_no) > 0 THEN SUM(amount) / COUNT(DISTINCT invoice_no) ELSE 0 END as avg_basket
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY shop_name
        ORDER BY total DESC
      ) sh
    ),
    'products', (
      SELECT COALESCE(json_agg(pr), '[]'::json)
      FROM (
        SELECT 
          product_name as name,
          COALESCE(segment, '') as seg,
          COALESCE(category, '') as cat,
          SUM(amount) as rev,
          SUM(qty) as qty,
          SUM(wght) as wght,
          CASE WHEN SUM(wght) > 0 THEN SUM(amount) / SUM(wght) ELSE 0 END as mwk_per_kg,
          COUNT(DISTINCT invoice_no) as baskets,
          CASE WHEN COUNT(DISTINCT invoice_no) > 0 THEN SUM(amount) / COUNT(DISTINCT invoice_no) ELSE 0 END as avg_basket,
          (SUM(amount) / NULLIF((SELECT SUM(amount) FROM retail_sales WHERE (p_start_date IS NULL OR sale_date >= p_start_date) AND (p_end_date IS NULL OR sale_date <= p_end_date)), 0)) * 100 as pct
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY product_name, segment, category
        ORDER BY rev DESC
      ) pr
    ),
    'regions', (
      SELECT json_build_object(
        'labels', COALESCE(json_agg(r.region), '[]'::json),
        'data', COALESCE(json_agg(r.rev), '[]'::json),
        'qty', COALESCE(json_agg(r.qty), '[]'::json),
        'n_shops', COALESCE(json_agg(r.n_shops), '[]'::json),
        'avg_per_shop', COALESCE(json_agg(r.avg_per_shop), '[]'::json)
      )
      FROM (
        SELECT 
          COALESCE(region, 'Unknown') as region, 
          SUM(amount) as rev, 
          SUM(qty) as qty,
          COUNT(DISTINCT shop_name) as n_shops,
          SUM(amount) / NULLIF(COUNT(DISTINCT shop_name), 0) as avg_per_shop
        FROM retail_sales
        WHERE (p_start_date IS NULL OR sale_date >= p_start_date)
          AND (p_end_date IS NULL OR sale_date <= p_end_date)
        GROUP BY 1
        ORDER BY rev DESC
      ) r
    ),
    'region_hour', json_build_object(),
    'shop_hour', '[]'::json
  ) INTO result;

  RETURN result;
END;
$$;

-- 3. Set a specific 60-second timeout on this RPC function (prevents 57014 statement timeout)
ALTER FUNCTION get_dashboard_summary(date, date) SET statement_timeout = '60s';

-- 4. Create composite indexes for high-speed table scans
CREATE INDEX IF NOT EXISTS idx_retail_sales_date ON retail_sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_retail_sales_shop ON retail_sales (shop_name);
CREATE INDEX IF NOT EXISTS idx_retail_sales_segment ON retail_sales (segment);
CREATE INDEX IF NOT EXISTS idx_retail_sales_region ON retail_sales (region);
CREATE INDEX IF NOT EXISTS idx_retail_sales_invoice ON retail_sales (invoice_no);

CREATE INDEX IF NOT EXISTS idx_retail_sales_date_seg ON retail_sales (sale_date, segment);
CREATE INDEX IF NOT EXISTS idx_retail_sales_date_shop ON retail_sales (sale_date, shop_name);
CREATE INDEX IF NOT EXISTS idx_retail_sales_date_product ON retail_sales (sale_date, product_name);