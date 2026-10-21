-- 01 Staging
-- Load the raw files as delivered, with explicit types. No business rules here.
-- {{RAW}} is replaced by the pipeline with the raw data folder.

CREATE SCHEMA IF NOT EXISTS stg;

CREATE OR REPLACE TABLE stg.funds AS
SELECT * FROM read_csv('{{RAW}}/funds.csv', header = true,
    columns = {'fund_id': 'VARCHAR', 'fund_name': 'VARCHAR'});

CREATE OR REPLACE TABLE stg.companies AS
SELECT * FROM read_csv('{{RAW}}/companies.csv', header = true,
    columns = {'company_id': 'VARCHAR', 'company_name': 'VARCHAR', 'sector': 'VARCHAR',
               'country': 'VARCHAR', 'high_risk_sector': 'BOOLEAN'});

CREATE OR REPLACE TABLE stg.company_financials AS
SELECT * FROM read_csv('{{RAW}}/company_financials.csv', header = true,
    columns = {'company_id': 'VARCHAR', 'fy_end': 'DATE',
               'revenue_nzd_m': 'DOUBLE', 'evic_nzd_m': 'DOUBLE'});

CREATE OR REPLACE TABLE stg.emissions_vendor AS
SELECT * FROM read_csv('{{RAW}}/emissions_vendor.csv', header = true,
    columns = {'company_id': 'VARCHAR', 'fy_end': 'DATE', 'scope1_t': 'DOUBLE',
               'scope2_t': 'DOUBLE', 'scope3_t': 'DOUBLE', 'vendor_load_date': 'DATE'});

CREATE OR REPLACE TABLE stg.instruments AS
SELECT * FROM read_csv('{{RAW}}/instruments.csv', header = true,
    columns = {'instrument_id': 'VARCHAR', 'company_id': 'VARCHAR',
               'asset_class': 'VARCHAR', 'description': 'VARCHAR'});

CREATE OR REPLACE TABLE stg.holdings AS
SELECT * FROM read_csv('{{RAW}}/holdings.csv', header = true,
    columns = {'fund_id': 'VARCHAR', 'report_date': 'DATE', 'instrument_id': 'VARCHAR',
               'market_value_nzd': 'DOUBLE', 'face_value_nzd': 'DOUBLE'});
