import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { loadWorkbook, WorkbookData, AssetMeta } from "@/lib/dataLoader";
import { fxOnDate, toNzdSeries } from "@/lib/fx";
import { derivePortfolioValueSeries, latestSnapshotWeights, PortfolioValuePoint } from "@/lib/portfolioValue";

interface DataContextValue extends WorkbookData {
  loading: boolean;
  error: string | null;
  getAsset: (ticker: string) => AssetMeta | undefined;
  getSeries: (ticker: string) => { date: string; price: number }[];
  getNzdSeries: (ticker: string) => { date: string; price: number }[];
  fxOn: (ccy: string, date: string) => number;
  portfolioNames: string[];
  getHoldings: (name: string) => { ticker: string; weight: number }[];
  getBenchmark: (name: string) => string | undefined;
  getPortfolioValueSeries: (name: string) => PortfolioValuePoint[];
  dataDateRange: { min: string; max: string } | null;
  loadUserData: (data: WorkbookData) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY: WorkbookData = {
  assets: [],
  prices: [],
  fxRates: [],
  holdings: [],
  benchmarks: [],
  priceSeries: {},
  fxSeries: {},
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkbookData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkbook()
      .then((d) => setData(d))
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<DataContextValue>(() => {
    const assetMap = new Map(data.assets.map((a) => [a.ticker, a]));
    const portfolioNames = Array.from(new Set(data.holdings.map((h) => h.portfolio_name)));
    let dMin = "", dMax = "";
    for (const series of Object.values(data.priceSeries)) {
      if (!series.length) continue;
      const first = series[0].date, last = series[series.length - 1].date;
      if (!dMin || first < dMin) dMin = first;
      if (!dMax || last > dMax) dMax = last;
    }
    const dataDateRange = dMin && dMax ? { min: dMin, max: dMax } : null;
    return {
      ...data,
      loading,
      error,
      dataDateRange,
      getAsset: (t) => assetMap.get(t),
      getSeries: (t) => data.priceSeries[t] ?? [],
      getNzdSeries: (t) => {
        const meta = assetMap.get(t);
        const series = data.priceSeries[t] ?? [];
        if (!meta || meta.currency === "NZD") return series;
        return toNzdSeries(series, meta.currency, data.fxSeries);
      },
      fxOn: (ccy, date) => fxOnDate(data.fxSeries, ccy, date),
      portfolioNames,
      getHoldings: (name) =>
        latestSnapshotWeights(name, data.holdings, data.fxSeries, data.assets),
      getBenchmark: (name) =>
        data.benchmarks.find((b) => b.portfolio_name === name)?.benchmark_ticker,
      getPortfolioValueSeries: (name) =>
        derivePortfolioValueSeries({
          portfolioName: name,
          holdings: data.holdings,
          assets: data.assets,
          priceSeries: data.priceSeries,
          fxSeries: data.fxSeries,
        }),
      loadUserData: (newData: WorkbookData) => {
        setData(newData);
        setError(null);
      },
    };
  }, [data, loading, error]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
