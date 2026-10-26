# Investment data and analytics projects

Teresa Brandts-Giesen. I work on both sides of investment data: the portfolio questions (allocation, risk, performance, climate reporting) and the engineering that answers them (data pipelines, SQL warehouses, automated checks, dashboards). About 25 years in quantitative investment management, most recently running Bluepoint Analytics, an independent investment analytics consultancy in Auckland.

## Projects

| Project | What it shows | Stack |
|---|---|---|
| [Climate Disclosure Warehouse](ClimateDisclosureWarehouse/) | A layered SQL pipeline that turns fund holdings and vendor emissions data into financed emissions, carbon footprint, WACI and coverage. Handles late reporters, vendor restatements and Scope 3 gaps; data quality checks stop bad runs; known-answer tests. Synthetic data. [Dashboard](https://teresadza.github.io/investment-data-portfolio/ClimateDisclosureWarehouse/docs/) | SQL (DuckDB), Python, pytest, D3 |
| [Allocation Frontier](AllocationFrontier/) | Monte Carlo search for allocations that maximise the probability of beating a 7.5% return objective, on real assumptions and 22 years of index returns. Stress-tests the private equity proxy, which barely moves with listed equities: made equity-like, the maximum probability portfolio's risk rises from 8.1% to 10.8%. [Dashboard](https://teresadza.github.io/investment-data-portfolio/AllocationFrontier/docs/) | Python (NumPy, pandas, SciPy), pytest, D3 |
| [Return Regimes](ReturnRegimes/) | Splits index histories into bull and bear regimes with a piecewise trend and compares indices regime by regime over identical months. Synthetic data with known regimes, so detection accuracy is measured: 7 to 8 of 10 regime changes found within 3 months. [Dashboard](https://teresadza.github.io/investment-data-portfolio/ReturnRegimes/docs/) | Python, pandas, pytest, D3 |
| [Portfolio Tools](asset-chart-compass/) | A browser app for NZ portfolios: NZD valuation from holdings snapshots and FX, time-weighted return with the currency effect shown separately, asset comparison, and what-if allocations against a baseline. Includes the regime model as an optional FastAPI service. | React, TypeScript, Recharts, Python (FastAPI) |
| [Datastream extraction](Datastream_/) | Config-driven, incremental extract of total return indices from LSEG Datastream: history loaded once, then a rolling current-month value each run, with logging. | Python, DatastreamPy, pandas |

## How the work is built

- **Reproducible.** Each project runs from one command and rebuilds from its inputs.
- **Checked.** Pipelines test their own output (reconciliations, coverage, duplicates) and fail loudly.
- **Explained.** Every metric has its formula and a worked example in the project README.
- **Safe to share.** No credentials, licensed market data or client data are committed. Where real data cannot be shared, the projects use synthetic data built to have the same problems.

## Contact

teresa@blupointanalytics.co.nz
