export interface PricePoint {
  date: string;
  price: number;
  change: number;
  changePercent: number;
}

export function toPricePoints(series: { date: string; price: number }[]): PricePoint[] {
  const out: PricePoint[] = [];
  let prev: number | null = null;
  for (const p of series) {
    const change = prev != null ? p.price - prev : 0;
    const changePercent = prev != null && prev !== 0 ? (change / prev) * 100 : 0;
    out.push({
      date: p.date,
      price: p.price,
      change: Math.round(change * 10000) / 10000,
      changePercent: Math.round(changePercent * 10000) / 10000,
    });
    prev = p.price;
  }
  return out;
}

export function filterByDateRange<T extends { date: string }>(data: T[], start: Date, end: Date): T[] {
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= s && d.date <= e);
}
