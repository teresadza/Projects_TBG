-- 05 Data quality checks
-- Each check counts failing rows. Severity 'error' stops the pipeline;
-- 'warning' is reported but the run continues.

CREATE SCHEMA IF NOT EXISTS dq;

CREATE OR REPLACE TABLE dq.results AS
SELECT * FROM (
    SELECT 'Q01' AS check_id, 'error' AS severity,
           'Holdings that reference an unknown instrument' AS description,
           (SELECT COUNT(*) FROM stg.holdings h
             WHERE NOT EXISTS (SELECT 1 FROM dim.instrument i WHERE i.instrument_id = h.instrument_id)) AS failures
    UNION ALL
    SELECT 'Q02', 'error', 'Duplicate holdings (same fund, date and instrument)',
           (SELECT COUNT(*) FROM (SELECT fund_id, report_date, instrument_id FROM stg.holdings
                                   GROUP BY ALL HAVING COUNT(*) > 1))
    UNION ALL
    SELECT 'Q03', 'error', 'Holdings with zero or negative market value',
           (SELECT COUNT(*) FROM stg.holdings WHERE market_value_nzd <= 0 OR market_value_nzd IS NULL)
    UNION ALL
    SELECT 'Q04', 'error', 'More than one current emissions figure per company, year and scope',
           (SELECT COUNT(*) FROM (SELECT company_id, fy_end, scope FROM dim.emissions WHERE is_current
                                   GROUP BY ALL HAVING COUNT(*) > 1))
    UNION ALL
    SELECT 'Q05', 'error', 'Attribution factor above 1 (fund owns more than the company is worth)',
           (SELECT COUNT(*) FROM fact.holding WHERE attribution_factor > 1)
    UNION ALL
    SELECT 'Q06', 'error', 'Coverage outside 0 to 100%',
           (SELECT COUNT(*) FROM fact.portfolio_metrics WHERE coverage < 0 OR coverage > 1)
    UNION ALL
    SELECT 'Q07', 'error', 'Fund value in the fact table does not reconcile to staged holdings',
           (SELECT COUNT(*) FROM (
                SELECT fund_id, report_date, SUM(market_value_nzd) AS v FROM stg.holdings GROUP BY ALL) s
            JOIN (SELECT fund_id, report_date, SUM(market_value_nzd) AS v FROM fact.holding
                   WHERE scope = 'Scope 1' GROUP BY ALL) f USING (fund_id, report_date)
            WHERE ABS(s.v - f.v) > 0.01)
    UNION ALL
    SELECT 'Q08', 'warning', 'Corporate bonds with no face value (market value used instead)',
           (SELECT COUNT(*) FROM stg.holdings h JOIN dim.instrument i USING (instrument_id)
             WHERE i.asset_class = 'Corporate bond' AND h.face_value_nzd IS NULL)
    UNION ALL
    SELECT 'Q09', 'warning', 'Fund results where Scope 1+2 coverage is below 80%',
           (SELECT COUNT(*) FROM fact.portfolio_metrics
             WHERE scope = 'Scope 1+2' AND asset_class = 'All corporate' AND coverage < 0.8)
    UNION ALL
    SELECT 'Q10', 'warning', 'Fund results where more than 10% of value uses prior year emissions',
           (SELECT COUNT(*) FROM fact.portfolio_metrics
             WHERE scope = 'Scope 1+2' AND asset_class = 'All corporate' AND fallback_share > 0.10)
    UNION ALL
    SELECT 'Q11', 'warning', 'Company, year and scope figures restated by the vendor (latest delivery used)',
           (SELECT COUNT(*) FROM (SELECT company_id, fy_end, scope FROM dim.emissions
                                   GROUP BY ALL HAVING COUNT(*) > 1))
)
ORDER BY check_id;
