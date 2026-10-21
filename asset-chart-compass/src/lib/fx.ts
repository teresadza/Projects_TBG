// FX utilities — convert local prices to NZD using forward-filled rates.

export type FxSeries = Record<string, { date: string; rate: number }[]>;

/**
 * Forward-fill lookup of fx rate for a currency on a given date.
 * NZD always returns 1. Unknown currency or no rates -> 1 (graceful).
 */
export function fxOnDate(fxSeries: FxSeries, ccy: string, date: string): number {
  const c = (ccy || "NZD").toUpperCase();
  if (c === "NZD") return 1;
  const series = fxSeries[c];
  if (!series || !series.length) return 1;
  // binary search last entry with date <= target
  let lo = 0, hi = series.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= date) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  if (ans === -1) return series[0].rate; // before first sample -> use earliest
  return series[ans].rate;
}

/** Convert a local-price series to NZD by date-aligned FX lookup. */
export function toNzdSeries(
  priceSeries: { date: string; price: number }[],
  ccy: string,
  fxSeries: FxSeries
): { date: string; price: number }[] {
  return priceSeries.map((p) => ({
    date: p.date,
    price: p.price * fxOnDate(fxSeries, ccy, p.date),
  }));
}
