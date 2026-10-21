-- 03 Holding level facts
-- One row per fund, report date, holding and scope, with the emissions and
-- financials used and the emissions attributed to the fund.
--
-- Year matching: a 31 March report uses the financial year that ended the
-- previous 31 December. If the company has not reported that year yet, the
-- prior year is used and the row is flagged as a fallback. EVIC and revenue
-- come from the same year as the emissions, so the ratio is consistent.
--
-- Attribution value: market value for listed equity, face value (outstanding
-- amount) for corporate bonds, following the PCAF approach.

CREATE SCHEMA IF NOT EXISTS fact;

CREATE OR REPLACE TABLE fact.holding AS
WITH h AS (
    SELECT hd.fund_id,
           hd.report_date,
           hd.instrument_id,
           i.company_id,
           i.asset_class,
           i.is_corporate,
           hd.market_value_nzd,
           CASE WHEN i.asset_class = 'Corporate bond' THEN COALESCE(hd.face_value_nzd, hd.market_value_nzd)
                ELSE hd.market_value_nzd END AS attribution_value_nzd,
           make_date(year(hd.report_date) - 1, 12, 31) AS target_fy_end
    FROM stg.holdings hd
    JOIN dim.instrument i USING (instrument_id)
),
scopes AS (
    SELECT * FROM (VALUES ('Scope 1'), ('Scope 2'), ('Scope 1+2'), ('Scope 3')) s(scope)
),
hs AS (
    SELECT h.*, s.scope FROM h CROSS JOIN scopes s
),
matched AS (
    SELECT hs.*,
           COALESCE(e0.fy_end, e1.fy_end)   AS used_fy_end,
           COALESCE(e0.tonnes, e1.tonnes)   AS company_emissions_t,
           e0.fy_end IS NULL AND e1.fy_end IS NOT NULL AS is_fallback
    FROM hs
    LEFT JOIN dim.emissions e0
           ON e0.company_id = hs.company_id AND e0.scope = hs.scope AND e0.is_current
          AND e0.fy_end = hs.target_fy_end
    LEFT JOIN dim.emissions e1
           ON e1.company_id = hs.company_id AND e1.scope = hs.scope AND e1.is_current
          AND e1.fy_end = hs.target_fy_end - INTERVAL 1 YEAR
)
SELECT m.fund_id,
       m.report_date,
       m.instrument_id,
       m.company_id,
       c.sector,
       COALESCE(c.high_risk_sector, false)                      AS high_risk_sector,
       m.asset_class,
       m.is_corporate,
       m.scope,
       m.market_value_nzd,
       m.attribution_value_nzd,
       m.target_fy_end,
       m.used_fy_end,
       COALESCE(m.is_fallback, false)                           AS is_fallback,
       m.company_emissions_t,
       f.evic_nzd_m,
       f.revenue_nzd_m,
       -- covered = corporate holding with emissions and the denominator it needs
       m.is_corporate AND m.company_emissions_t IS NOT NULL AND f.evic_nzd_m    IS NOT NULL AS covered_evic,
       m.is_corporate AND m.company_emissions_t IS NOT NULL AND f.revenue_nzd_m IS NOT NULL AS covered_revenue,
       m.attribution_value_nzd / (f.evic_nzd_m * 1e6)           AS attribution_factor,
       m.attribution_value_nzd / (f.evic_nzd_m * 1e6) * m.company_emissions_t AS financed_emissions_t,
       m.company_emissions_t / f.revenue_nzd_m                  AS intensity_t_per_revenue_m
FROM matched m
LEFT JOIN dim.company c   ON c.company_id = m.company_id
LEFT JOIN dim.financials f ON f.company_id = m.company_id AND f.fy_end = m.used_fy_end;
