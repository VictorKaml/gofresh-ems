CREATE OR REPLACE VIEW public.employee_attendance_summary AS
WITH daily_punches AS (
    -- 1. Grab the absolute earliest 'Check In' and latest 'Check Out' for each employee per day
    SELECT 
        staff_code,
        swipe_date,
        weekday,
        MIN(swipe_time) FILTER (WHERE swipe_type ILIKE '%In%') AS clock_in,
        MAX(swipe_time) FILTER (WHERE swipe_type ILIKE '%Out%') AS clock_out
    FROM public.attendance_records
    GROUP BY staff_code, swipe_date, weekday
),
shift_calculations AS (
    -- 2. Calculate actual hours and set caps (8.5 hours for weekdays, 5.5 hours for weekends)
    SELECT 
        dp.*,
        CASE 
            WHEN dp.clock_in IS NOT NULL AND dp.clock_out IS NOT NULL THEN
                ROUND((EXTRACT(EPOCH FROM (dp.clock_out - dp.clock_in)) / 3600)::numeric, 2)
            ELSE 0 
        END AS total_shift_hours,
        CASE 
            WHEN dp.weekday IN ('Saturday', 'Sunday') THEN 5.5
            ELSE 8.5
        END AS shift_cap
    FROM daily_punches dp
)
-- 3. Output a clean layout with regular hours, overtime, and calculated statuses
SELECT 
    sc.staff_code,
    sc.swipe_date,
    sc.weekday,
    COALESCE(sc.clock_in::text, '—') AS clock_in,
    COALESCE(sc.clock_out::text, '—') AS clock_out,
    sc.total_shift_hours,
    
    -- Split regular hours vs overtime based on the caps
    CASE 
        WHEN sc.total_shift_hours > sc.shift_cap THEN sc.shift_cap
        ELSE sc.total_shift_hours
    END AS regular_hours_worked,
    
    CASE 
        WHEN sc.total_shift_hours > sc.shift_cap THEN ROUND((sc.total_shift_hours - sc.shift_cap)::numeric, 2)
        ELSE 0
    END AS overtime_hours,

    -- Dynamic Status Flags
    CASE 
        WHEN sc.clock_in IS NULL AND sc.clock_out IS NULL THEN 'NO RECORD FOUND'
        WHEN sc.clock_in IS NULL OR sc.clock_out IS NULL THEN 'MISSED A CLOCK PUNCH'
        WHEN sc.clock_in > '07:30:00' THEN 'LATE'
        ELSE 'ON TIME'
    END AS attendance_status
FROM shift_calculations sc;