import { useState, useMemo, useEffect } from "react";
import { subYears, format, parseISO } from "date-fns";

import { useData } from "@/contexts/DataContext";
import { PortfolioAllocator } from "@/components/PortfolioAllocator";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PortfolioSummaryCards } from "@/components/PortfolioSummaryCards";
import { ContributionTable } from "@/components/ContributionTable";
import { calculateCumulativeReturns } from "@/lib/portfolioCalc";
import { computeStats, computeStatsRelativeDrawdowns, PortfolioStats } from "@/lib/portfolioStats";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine,
} from "recharts";

const Monitoring = () => {
  const {
    portfolioNames, getHoldings, getBenchmark, getAsset, getNzdSeries,
    getPortfolioValueSeries, holdings, dataDateRange, loading, error,
  } = useData();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [startDate, setStartDate] = useState(() => subYears(new Date(), 2));
  const [endDate, setEndDate] = useState(() => new Date());
  const [mode, setMode] = useState<"return" | "value">("return");
  const [datesInitialized, setDatesInitialized] = useState(false);
  useEffect(() => {
    if (!datesInitialized && dataDateRange) {
      const end = new Date(dataDateRange.max);
      setEndDate(end);
      setStartDate(subYears(end, 2));
      setDatesInitialized(true);
    }
  }, [dataDateRange, datesInitialized]);

  useEffect(() => {
    if (!selectedPortfolio && portfolioNames.length) setSelectedPortfolio(portfolioNames[0]);
  }, [portfolioNames, selectedPortfolio]);

  const allocations = useMemo(
    () => (selectedPortfolio ? getHoldings(selectedPortfolio) : []),
    [selectedPortfolio, getHoldings]
  );
  const benchmarkTicker = selectedPortfolio ? getBenchmark(selectedPortfolio) : undefined;

  // Derived NZD value + TWR series from snapshot evolution
  const fullSeries = useMemo(
    () => (selectedPortfolio ? getPortfolioValueSeries(selectedPortfolio) : []),
    [selectedPortfolio, getPortfolioValueSeries]
  );
  const s = startDate.toISOString().slice(0, 10);
  const e = endDate.toISOString().slice(0, 10);
  const filtered = useMemo(
    () => fullSeries.filter((p) => p.date >= s && p.date <= e),
    [fullSeries, s, e]
  );

  // Re-base TWR returns to filter window so chart starts at 0%
  const baseReturn = filtered[0]?.return_pct ?? 0;
  const baseValue = filtered[0]?.value_nzd ?? 0;

  // Benchmark series in NZD, re-based to window start
  const benchmarkLookup = useMemo(() => {
    if (!benchmarkTicker) return null;
    const series = calculateCumulativeReturns(benchmarkTicker, startDate, endDate, getNzdSeries);
    const map: Record<string, number> = {};
    for (const p of series) map[p.date] = p.cumret;
    return map;
  }, [benchmarkTicker, startDate, endDate, getNzdSeries]);

  // Snapshot dates within window for vertical reference lines
  const snapshotDatesInWindow = useMemo(() => {
    return Array.from(
      new Set(
        holdings
          .filter((h) => h.portfolio_name === selectedPortfolio)
          .map((h) => h.effective_date)
      )
    )
      .filter((d) => d >= s && d <= e)
      .sort();
  }, [holdings, selectedPortfolio, s, e]);

  const chartData = useMemo(() => {
    return filtered.map((p) => {
      const ret = +(p.return_pct - baseReturn).toFixed(2);
      const val = +(baseValue ? (p.value_nzd / baseValue) * 100 : 0).toFixed(2);
      const row: Record<string, any> = {
        date: p.date,
        portfolio: mode === "return" ? ret : Math.round(p.value_nzd * 100) / 100,
        portfolio_indexed: val,
      };
      if (benchmarkLookup && benchmarkLookup[p.date] != null && mode === "return") {
        row[benchmarkTicker!] = benchmarkLookup[p.date];
      }
      return row;
    });
  }, [filtered, baseReturn, baseValue, benchmarkLookup, benchmarkTicker, mode]);

  const summaryStats = useMemo<PortfolioStats[]>(() => {
    if (filtered.length < 2) return [];
    const dates = filtered.map((p) => p.date);
    const vals = filtered.map((p) => p.return_pct - baseReturn);
    const portfolioStats = computeStats("Portfolio (NZD)", dates, vals, 3);
    const stats: PortfolioStats[] = [portfolioStats];
    if (benchmarkTicker && benchmarkLookup) {
      const bvals = dates.map((d) => benchmarkLookup[d] ?? 0);
      stats.push(
        computeStatsRelativeDrawdowns(`Benchmark: ${benchmarkTicker} (NZD)`, dates, bvals, portfolioStats)
      );
    }
    return stats;
  }, [filtered, baseReturn, benchmarkTicker, benchmarkLookup]);

  const allVals: number[] = [];
  for (const row of chartData) {
    for (const [k, v] of Object.entries(row)) {
      if (k === "date" || k === "portfolio_indexed") continue;
      if (typeof v === "number") allVals.push(v);
    }
  }
  const min = allVals.length ? Math.min(...allVals) : 0;
  const max = allVals.length ? Math.max(...allVals) : 10;
  const padding = (max - min) * 0.1 || 2;
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  const totalNzd = filtered[filtered.length - 1]?.value_nzd ?? 0;

  if (loading) return <main className="container mx-auto px-4 py-10 text-muted-foreground">Loading data…</main>;
  if (error) return <main className="container mx-auto px-4 py-10 text-destructive">Error loading data: {error}</main>;

  if (!portfolioNames.length) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No portfolios configured. Add rows to the <code className="text-xs">portfolio_holdings</code> sheet.
        </CardContent></Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Portfolio Monitoring</h2>
          <Badge variant="secondary">Actual · NZD</Badge>
        </div>
        <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Choose portfolio" /></SelectTrigger>
          <SelectContent>
            {portfolioNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-1">Current value</div>
            <div className="text-2xl font-bold font-mono">
              {totalNzd.toLocaleString(undefined, { maximumFractionDigits: 0 })} NZD
            </div>
            <div className="text-xs text-muted-foreground mt-1">As of {filtered[filtered.length - 1]?.date ?? "—"}</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Latest weights (NZD-based)</div>
            <div className="space-y-1">
              {allocations.map((a) => (
                <div key={a.ticker} className="flex items-center gap-2 text-xs">
                  <div className="w-16 font-semibold">{a.ticker}</div>
                  <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${a.weight}%` }} />
                  </div>
                  <div className="w-12 text-right font-mono">{a.weight.toFixed(1)}%</div>
                  <div className="w-32 truncate text-muted-foreground">{getAsset(a.ticker)?.asset_class}</div>
                </div>
              ))}
            </div>
            {benchmarkTicker && (
              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                Benchmark: <span className="font-semibold text-foreground">{benchmarkTicker}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        <div className="flex items-center gap-2">
          <span className={`text-xs ${mode === "return" ? "font-semibold" : "text-muted-foreground"}`}>Return %</span>
          <Switch checked={mode === "value"} onCheckedChange={(v) => setMode(v ? "value" : "return")} />
          <span className={`text-xs ${mode === "value" ? "font-semibold" : "text-muted-foreground"}`}>Value $</span>
        </div>
      </div>

      {filtered.length < 2 ? (
        <Card><CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
          No portfolio data in range
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-4 pt-5">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "MMM yy")} interval={tickInterval} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis
                  domain={[Math.floor(min - padding), Math.ceil(max + padding)]}
                  tickFormatter={(v) => mode === "return" ? `${v}%` : v.toLocaleString()}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg text-sm min-w-[160px]">
                        <div className="font-medium mb-1.5">{format(parseISO(label), "MMM d, yyyy")}</div>
                        {payload.filter((e: any) => e.dataKey !== "portfolio_indexed").map((entry: any) => (
                          <div key={entry.dataKey} className="flex justify-between gap-4 items-center">
                            <span style={{ color: entry.stroke }} className="font-semibold text-xs">{entry.dataKey}</span>
                            <span className="font-mono text-xs">
                              {entry.value != null
                                ? mode === "return"
                                  ? `${Number(entry.value).toFixed(2)}%`
                                  : `${Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 0 })} NZD`
                                : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                {snapshotDatesInWindow.map((d) => (
                  <ReferenceLine key={d} x={d} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" strokeOpacity={0.5} label={{ value: "snap", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                ))}
                <Line type="monotone" dataKey="portfolio" stroke="#16a34a" strokeWidth={2.5} dot={false} animationDuration={500} connectNulls name={mode === "return" ? "Portfolio (NZD)" : "Portfolio value (NZD)"} />
                {benchmarkTicker && mode === "return" && (
                  <Line type="monotone" dataKey={benchmarkTicker} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} animationDuration={500} connectNulls name={`${benchmarkTicker} (benchmark, NZD)`} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <PortfolioSummaryCards stats={summaryStats} />

      {allocations.length > 0 && (
        <ContributionTable allocations={allocations} startDate={startDate} endDate={endDate} />
      )}
    </main>
  );
};

export default Monitoring;
