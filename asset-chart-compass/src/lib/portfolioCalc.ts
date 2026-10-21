import { filterByDateRange } from "./priceSeries";

export interface Allocation {
  ticker: string;
  weight: number; // 0-100
}

export interface PortfolioPoint {
  date: string;
  portfolio: number;
  [key: string]: number | string;
}

type SeriesGetter = (ticker: string) => { date: string; price: number }[];

/**
 * Compounded portfolio cumulative return:
 *   daily_r_i = pct_change(price_i)
 *   portfolio_daily = sum(w_i * daily_r_i)
 *   cumret = (1 + portfolio_daily).cumprod() - 1
 */
export function calculatePortfolioReturns(
  allocations: Allocation[],
  startDate: Date,
  endDate: Date,
  getSeries: SeriesGetter
): PortfolioPoint[] {
  if (allocations.length === 0) return [];

  const seriesMap: Record<string, { date: string; price: number }[]> = {};
  for (const a of allocations) {
    const s = getSeries(a.ticker);
    if (s.length) seriesMap[a.ticker] = filterByDateRange(s, startDate, endDate);
  }

  const allDates = new Set<string>();
  for (const s of Object.values(seriesMap)) for (const p of s) allDates.add(p.date);
  const sortedDates = Array.from(allDates).sort();
  if (!sortedDates.length) return [];

  const priceLookup: Record<string, Record<string, number>> = {};
  for (const [t, s] of Object.entries(seriesMap)) {
    priceLookup[t] = {};
    for (const p of s) priceLookup[t][p.date] = p.price;
  }

  const prevPrice: Record<string, number | null> = {};
  const cumFactor: Record<string, number> = {};
  const assetCumRet: Record<string, Record<string, number>> = {};
  for (const a of allocations) {
    prevPrice[a.ticker] = null;
    cumFactor[a.ticker] = 1;
    assetCumRet[a.ticker] = {};
  }

  let portfolioFactor = 1;
  const result: PortfolioPoint[] = [];

  for (const date of sortedDates) {
    let weightedDaily = 0;
    for (const a of allocations) {
      const price = priceLookup[a.ticker]?.[date];
      if (price == null) continue;
      const prev = prevPrice[a.ticker];
      if (prev != null && prev !== 0) {
        const r = price / prev - 1;
        cumFactor[a.ticker] *= 1 + r;
        weightedDaily += (a.weight / 100) * r;
      }
      prevPrice[a.ticker] = price;
      assetCumRet[a.ticker][date] = (cumFactor[a.ticker] - 1) * 100;
    }
    portfolioFactor *= 1 + weightedDaily;

    const row: PortfolioPoint = {
      date,
      portfolio: Math.round((portfolioFactor - 1) * 10000) / 100,
    };
    for (const a of allocations) {
      if (assetCumRet[a.ticker][date] != null) {
        row[a.ticker] = Math.round(assetCumRet[a.ticker][date] * 100) / 100;
      }
    }
    result.push(row);
  }
  return result;
}

export function calculateCumulativeReturns(
  ticker: string,
  startDate: Date,
  endDate: Date,
  getSeries: SeriesGetter
): { date: string; cumret: number }[] {
  const series = getSeries(ticker);
  if (!series.length) return [];
  const filtered = filterByDateRange(series, startDate, endDate);
  if (!filtered.length) return [];
  const out: { date: string; cumret: number }[] = [];
  let factor = 1;
  let prev: number | null = null;
  for (const p of filtered) {
    if (prev != null && prev !== 0) factor *= p.price / prev;
    prev = p.price;
    out.push({ date: p.date, cumret: Math.round((factor - 1) * 10000) / 100 });
  }
  return out;
}
