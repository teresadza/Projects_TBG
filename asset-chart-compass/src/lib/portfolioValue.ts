// Derive portfolio NZD value + return series from snapshot-based holdings.
// Approach: at each snapshot, fix per-holding NZD value. Between snapshots,
// evolve each holding by local price growth × FX growth. At each snapshot
// boundary, re-anchor (rebalance / cashflow) and chain TWR returns.

import { fxOnDate, FxSeries } from "./fx";
import { HoldingRow, AssetMeta } from "./dataLoader";

export interface PortfolioValuePoint {
  date: string;
  value_nzd: number;
  return_pct: number; // chained TWR cumulative %, base 0
  isSnapshot?: boolean;
}

interface Inputs {
  portfolioName: string;
  holdings: HoldingRow[]; // all rows for this portfolio
  assets: AssetMeta[];
  priceSeries: Record<string, { date: string; price: number }[]>;
  fxSeries: FxSeries;
}

function unionSortedDates(tickers: string[], priceSeries: Inputs["priceSeries"]): string[] {
  const set = new Set<string>();
  for (const t of tickers) for (const p of priceSeries[t] ?? []) set.add(p.date);
  return Array.from(set).sort();
}

function priceLookupOnOrBefore(series: { date: string; price: number }[] | undefined, date: string): number | null {
  if (!series || !series.length) return null;
  let lo = 0, hi = series.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= date) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans === -1 ? null : series[ans].price;
}

export function derivePortfolioValueSeries(inp: Inputs): PortfolioValuePoint[] {
  const rows = inp.holdings
    .filter((h) => h.portfolio_name === inp.portfolioName)
    .slice()
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  if (!rows.length) return [];

  // group by snapshot date
  const snapshotDates = Array.from(new Set(rows.map((r) => r.effective_date))).sort();
  const tickers = Array.from(new Set(rows.map((r) => r.ticker)));
  const dates = unionSortedDates(tickers, inp.priceSeries);
  if (!dates.length) return [];

  const ccyOf = (ticker: string): string => {
    const m = inp.assets.find((a) => a.ticker === ticker);
    const fromHolding = rows.find((r) => r.ticker === ticker)?.local_ccy;
    return (fromHolding && fromHolding !== "" ? fromHolding : m?.currency) ?? "NZD";
  };

  // Build per-snapshot anchor: { ticker -> { anchorPriceLocal, anchorFx, nzdValueAtAnchor } }
  type Anchor = { tickerVals: Record<string, { priceLocal: number; fx: number; nzd: number }> };
  const anchors: Record<string, Anchor> = {};
  for (const sd of snapshotDates) {
    const snapRows = rows.filter((r) => r.effective_date === sd);
    const tv: Anchor["tickerVals"] = {};
    for (const r of snapRows) {
      const fx = fxOnDate(inp.fxSeries, r.local_ccy || ccyOf(r.ticker), sd);
      const priceLocal = priceLookupOnOrBefore(inp.priceSeries[r.ticker], sd);
      if (priceLocal == null) continue;
      tv[r.ticker] = {
        priceLocal,
        fx,
        nzd: r.market_value_local * fx, // value is already in local; NZD = local * fx
      };
    }
    anchors[sd] = { tickerVals: tv };
  }

  // Walk through dates; for each, find active snapshot; compute portfolio NZD value
  // and TWR by chaining through snapshot boundaries.
  const out: PortfolioValuePoint[] = [];
  let chainedFactor = 1;
  let prevValue: number | null = null;
  let activeSnap = "";
  for (const d of dates) {
    if (d < snapshotDates[0]) continue;
    // pick latest snapshot <= d
    let snapForDate = snapshotDates[0];
    for (const sd of snapshotDates) if (sd <= d) snapForDate = sd; else break;

    if (snapForDate !== activeSnap) {
      // boundary: re-anchor; close previous sub-period and start new (no return jump from cashflow)
      activeSnap = snapForDate;
      prevValue = null; // reset baseline for next sub-period
    }

    const anchor = anchors[snapForDate];
    let totalNzd = 0;
    for (const [ticker, av] of Object.entries(anchor.tickerVals)) {
      const px = priceLookupOnOrBefore(inp.priceSeries[ticker], d);
      if (px == null) continue;
      const fx = fxOnDate(inp.fxSeries, ccyOf(ticker), d);
      const evolved = av.nzd * (px / av.priceLocal) * (fx / av.fx);
      totalNzd += evolved;
    }
    if (totalNzd <= 0) continue;

    if (prevValue != null && prevValue > 0) {
      chainedFactor *= totalNzd / prevValue;
    }
    prevValue = totalNzd;

    out.push({
      date: d,
      value_nzd: Math.round(totalNzd * 100) / 100,
      return_pct: Math.round((chainedFactor - 1) * 10000) / 100,
      isSnapshot: d === snapForDate,
    });
  }
  return out;
}

/** Latest snapshot weights as percentages (NZD-based). */
export function latestSnapshotWeights(
  portfolioName: string,
  holdings: HoldingRow[],
  fxSeries: FxSeries,
  assets: AssetMeta[]
): { ticker: string; weight: number }[] {
  const rows = holdings.filter((h) => h.portfolio_name === portfolioName);
  if (!rows.length) return [];
  const dates = Array.from(new Set(rows.map((r) => r.effective_date))).sort();
  const latest = dates[dates.length - 1];
  const snap = rows.filter((r) => r.effective_date === latest);
  const ccyOf = (t: string) => assets.find((a) => a.ticker === t)?.currency ?? "NZD";
  const nzd = snap.map((r) => ({
    ticker: r.ticker,
    nzd: r.market_value_local * fxOnDate(fxSeries, r.local_ccy || ccyOf(r.ticker), latest),
  }));
  const total = nzd.reduce((s, x) => s + x.nzd, 0);
  if (total <= 0) return [];
  return nzd.map((x) => ({ ticker: x.ticker, weight: Math.round((x.nzd / total) * 1000) / 10 }));
}
