# Investment data and analytics projects

Teresa Brandts-Giesen. I work on both sides of investment data: the portfolio questions (allocation, risk, performance, climate reporting) and the engineering that answers them (data pipelines, SQL warehouses, automated checks, dashboards). About 25 years in quantitative investment management, most recently running Bluepoint Analytics, an independent investment analytics consultancy in Auckland.

## Projects

| Project | What it shows | Stack |
|---|---|---|
| [Climate Disclosure Warehouse](ClimateDisclosureWarehouse/) | A layered SQL pipeline that turns fund holdings and vendor emissions data into financed emissions, carbon footprint, WACI and coverage. Handles late reporters, vendor restatements and Scope 3 gaps; data quality checks stop bad runs; known-answer tests. Synthetic data. [Dashboard](https://teresadza.github.io/investment-data-portfolio/ClimateDisclosureWarehouse/docs/) | SQL (DuckDB), Python, pytest, D3 |
| [Datastream extraction](Datastream/) | Config-driven, incremental extract of total return indices from LSEG Datastream: history loaded once, then a rolling current-month value each run, with logging. | Python, DatastreamPy, pandas |

## How the work is built

- **Reproducible.** Each project runs from one command and rebuilds from its inputs.
- **Checked.** Pipelines test their own output (reconciliations, coverage, duplicates) and fail loudly.
- **Explained.** Every metric has its formula and a worked example in the project README.
- **Safe to share.** No credentials, licensed market data or client data are committed. Where real data cannot be shared, the projects use synthetic data built to have the same problems.

## Contact

teresa@blupointanalytics.co.nz
