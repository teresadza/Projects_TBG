-- 02 Dimensions
-- Clean reference data. Emissions keep every vendor delivery and flag the
-- current one, so a restatement replaces the earlier figure without losing it.

CREATE SCHEMA IF NOT EXISTS dim;

CREATE OR REPLACE TABLE dim.fund AS
SELECT fund_id, fund_name FROM stg.funds;

CREATE OR REPLACE TABLE dim.company AS
SELECT company_id, company_name, sector, country, high_risk_sector
FROM stg.companies;

CREATE OR REPLACE TABLE dim.instrument AS
SELECT instrument_id,
       NULLIF(company_id, '') AS company_id,
       asset_class,
       description,
       asset_class IN ('Listed equity', 'Corporate bond') AS is_corporate
FROM stg.instruments;

-- Financials: zero or negative values are treated as missing, not as data.
CREATE OR REPLACE TABLE dim.financials AS
SELECT company_id,
       fy_end,
       CASE WHEN revenue_nzd_m > 0 THEN revenue_nzd_m END AS revenue_nzd_m,
       CASE WHEN evic_nzd_m    > 0 THEN evic_nzd_m    END AS evic_nzd_m
FROM stg.company_financials;

-- Emissions in long form: one row per company, year, scope and delivery.
-- Scope 1+2 is derived only when both parts are reported.
CREATE OR REPLACE TABLE dim.emissions AS
WITH deliveries AS (
    SELECT company_id, fy_end, vendor_load_date,
           CASE WHEN scope1_t > 0 THEN scope1_t END AS s1,
           CASE WHEN scope2_t > 0 THEN scope2_t END AS s2,
           CASE WHEN scope3_t > 0 THEN scope3_t END AS s3
    FROM stg.emissions_vendor
),
long AS (
    SELECT company_id, fy_end, vendor_load_date, scope, tonnes
    FROM deliveries
    UNPIVOT (tonnes FOR scope IN (s1 AS 'Scope 1', s2 AS 'Scope 2', s3 AS 'Scope 3'))
    UNION ALL
    SELECT company_id, fy_end, vendor_load_date, 'Scope 1+2', s1 + s2
    FROM deliveries
    WHERE s1 IS NOT NULL AND s2 IS NOT NULL
)
SELECT *,
       ROW_NUMBER() OVER (PARTITION BY company_id, fy_end, scope
                          ORDER BY vendor_load_date DESC) = 1 AS is_current
FROM long
WHERE tonnes IS NOT NULL;
