-- 04 Portfolio metrics
-- Fund level climate metrics by report date, scope and asset class.
--
--   financed emissions (t)  = sum of attribution value / EVIC x company emissions
--   carbon footprint (t/$m) = financed emissions / covered attribution value in $m
--   WACI (t/$m revenue)     = sum of weight x (company emissions / revenue)
--                             weights are market value shares of the covered holdings
--   coverage                = covered market value / corporate market value
--
-- Only corporate holdings (listed equity and corporate bonds) are in scope.
-- Sovereign bonds and cash are reported in total value but not in the metrics.

CREATE OR REPLACE TABLE fact.portfolio_metrics AS
WITH base AS (
    SELECT * FROM fact.holding
),
agg AS (
    SELECT fund_id,
           report_date,
           scope,
           COALESCE(asset_class, 'All corporate')                                         AS asset_class,
           SUM(market_value_nzd)                                                          AS corporate_value_nzd,
           SUM(CASE WHEN covered_evic THEN market_value_nzd END)                          AS covered_value_nzd,
           SUM(CASE WHEN covered_evic THEN attribution_value_nzd END)                     AS covered_attribution_value_nzd,
           SUM(CASE WHEN covered_evic THEN financed_emissions_t END)                      AS financed_emissions_t,
           SUM(CASE WHEN covered_revenue THEN market_value_nzd END)                       AS waci_covered_value_nzd,
           SUM(CASE WHEN covered_revenue THEN market_value_nzd * intensity_t_per_revenue_m END) AS waci_numerator,
           SUM(CASE WHEN covered_evic AND is_fallback THEN market_value_nzd END)          AS fallback_value_nzd,
           SUM(CASE WHEN high_risk_sector THEN market_value_nzd END)                      AS high_risk_value_nzd,
           COUNT(DISTINCT instrument_id)                                                  AS holdings,
           COUNT(DISTINCT CASE WHEN covered_evic THEN instrument_id END)                  AS covered_holdings
    FROM base
    WHERE is_corporate
    GROUP BY GROUPING SETS ((fund_id, report_date, scope, asset_class), (fund_id, report_date, scope))
),
totals AS (
    SELECT fund_id, report_date, SUM(market_value_nzd) AS fund_value_nzd
    FROM base WHERE scope = 'Scope 1'
    GROUP BY ALL
)
SELECT a.fund_id,
       f.fund_name,
       a.report_date,
       a.scope,
       a.asset_class,
       t.fund_value_nzd,
       a.corporate_value_nzd,
       a.covered_value_nzd,
       a.holdings,
       a.covered_holdings,
       a.financed_emissions_t,
       a.financed_emissions_t / (a.covered_attribution_value_nzd / 1e6) AS carbon_footprint_t_per_m,
       a.waci_numerator / a.waci_covered_value_nzd                       AS waci_t_per_revenue_m,
       COALESCE(a.covered_value_nzd, 0) / a.corporate_value_nzd         AS coverage,
       COALESCE(a.fallback_value_nzd, 0) / a.corporate_value_nzd        AS fallback_share,
       COALESCE(a.high_risk_value_nzd, 0) / a.corporate_value_nzd       AS high_risk_share
FROM agg a
JOIN totals t USING (fund_id, report_date)
JOIN dim.fund f USING (fund_id);

-- Largest contributors to financed emissions, latest year per fund (Scope 1+2)
CREATE OR REPLACE TABLE fact.top_contributors AS
WITH latest AS (SELECT fund_id, MAX(report_date) AS report_date FROM fact.holding GROUP BY fund_id),
ranked AS (
    SELECT h.fund_id, h.report_date, h.instrument_id, c.company_name, h.sector, h.asset_class,
           h.market_value_nzd, h.financed_emissions_t, h.intensity_t_per_revenue_m, h.is_fallback,
           h.financed_emissions_t / SUM(h.financed_emissions_t) OVER (PARTITION BY h.fund_id) AS share_of_fund,
           ROW_NUMBER() OVER (PARTITION BY h.fund_id ORDER BY h.financed_emissions_t DESC) AS rank
    FROM fact.holding h
    JOIN latest USING (fund_id, report_date)
    LEFT JOIN dim.company c USING (company_id)
    WHERE h.scope = 'Scope 1+2' AND h.covered_evic
)
SELECT * FROM ranked WHERE rank <= 10;
