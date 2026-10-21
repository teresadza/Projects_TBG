# Portfolio Tools

A browser-based portfolio analytics prototype for New Zealand investors. It answers three questions: how has my portfolio done in NZD, how do these assets compare, and what would a different allocation have done?

**[Open the live app](LIVE_APP_URL)** · Prototype, built with sample data. Not investment advice.

## Three screens

| Screen | What it does |
|---|---|
| **Portfolio monitoring** | Values a portfolio in NZD from holdings snapshots, prices and FX rates. Shows the time-weighted return, the part of the return that came from currency moves, and each holding's contribution. |
| **Asset exploration** | Compares assets, benchmarks and portfolios on one chart, in local currency or NZD, over any date range. Fits a piecewise trend to split each history into regimes. |
| **Portfolio construction** | Loads current weights as the baseline, lets you change them, and shows the alternative's return, volatility and drawdowns against the baseline. Allocations can be saved and reloaded. |

You can load your own data from an Excel file with the same layout as `public/data/portfolio_data.xlsx`.

## How the numbers are worked out

**Portfolio value in NZD.** At each holdings snapshot, every holding's NZD value is fixed as local market value × FX rate. Between snapshots, each holding moves with its local price and its FX rate:

```
value_t = value_snapshot × (price_t ÷ price_snapshot) × (fx_t ÷ fx_snapshot)
```

FX rates are forward-filled, so a rate applies until the next one is published.

**Time-weighted return.** Returns are chained across snapshots, so cash flows and rebalancing at a snapshot date do not distort performance:

```
TWR = (1 + r_period1) × (1 + r_period2) × ... − 1
```

**What-if portfolios** hold constant weights, rebalanced daily:

```
portfolio daily return = Σ weightᵢ × daily returnᵢ
cumulative return      = Π (1 + portfolio daily return) − 1
```

**Statistics.**

- Annualised return = (1 + total return)^(1 / years) − 1
- Annualised volatility = standard deviation of daily returns, annualised
- The three largest drawdowns, from peak to trough, with recovery dates

Drawdowns can also be measured over the portfolio's own drawdown periods. This shows how each asset behaved when the portfolio was falling.

**Regime trend.** A greedy piecewise linear fit adds breakpoints at the point furthest from the current fit, until R² reaches 0.98 or a maximum number of segments is reached. It runs in the browser. An optional Python API (`api/main.py`, FastAPI) runs the same algorithm server-side.

## Stack

- **Front end:** React, TypeScript, Vite, Tailwind, shadcn/ui and Recharts. Excel files are read in the browser with SheetJS.
- **API (optional):** Python FastAPI service for the piecewise model. Set `VITE_PIECEWISE_API_URL` to use it; without it, everything runs client side.
- **Hosting:** a static site. `vercel.json` and `public/staticwebapp.config.json` set up page routing for Vercel and Azure Static Web Apps.

## Running locally

```
npm install
npm run dev
```

Optional API:

```
cd api
pip install -r requirements.txt
uvicorn main:app --reload
```

## Code layout

```
src/lib/portfolioValue.ts   NZD valuation and time-weighted return from holdings snapshots
src/lib/portfolioCalc.ts    constant-weight what-if portfolios
src/lib/portfolioStats.ts   annualised return, volatility, drawdowns
src/lib/fx.ts               forward-filled FX lookup and NZD conversion
src/lib/piecewiseModel.ts   greedy piecewise trend (browser)
src/lib/dataLoader.ts       Excel data loading and validation
api/main.py                 the same piecewise model as a FastAPI service
```

## Status

A working prototype. Next on the list: unit tests for the valuation and return calculations, and income and fee handling in the time-weighted return.

Built by Teresa Brandts-Giesen, Bluepoint Analytics. teresa@blupointanalytics.co.nz
