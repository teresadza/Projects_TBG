import { useState, useMemo, useEffect } from "react";
import { subYears, format, parseISO } from "date-fns";

import { useData } from "@/contexts/DataContext";
import { PortfolioAllocator } from "@/components/PortfolioAllocator";
import { PortfolioSaveLoad } from "@/components/PortfolioSaveLoad";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ComparisonSelector } from "@/components/ComparisonSelector";
import { PortfolioSummaryCards } from "@/components/PortfolioSummaryCards";
import { Allocation, calculatePortfolioReturns, calculateCumulativeReturns } from "@/lib/portfolioCalc";
import { computeStats, computeStatsRelativeDrawdowns, PortfolioStats } from "@/lib/portfolioStats";
import { fetchPiecewiseModel } from "@/lib/piecewiseApi";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

const OVERLAY_COLORS = ["#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f59e0b", "#d97706"];
const CONSTITUENT_COLORS = ["#64748b", "#94a3b8", "#78716c", "#a1a1aa", "#737373", "#9ca3af", "#a3a3a3", "#6b7280"];

const Portfolio = () => {
  const { getNzdSeries, portfolioNames, getHoldings, dataDateRange, loading, error } = useData();
  const getSeries = getNzdSeries;
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loadFromPortfolio, setLoadFromPortfolio] = useState<string>(portfolioNames[0] ?? "");
  const [baselineWeights, setBaselineWeights] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState(() => subYears(new Date(), 1));
  const [endDate, setEndDate] = useState(() => new Date());
  const [datesInitialized, setDatesInitialized] = useState(false);

  useEffect(() => {
    if (!datesInitialized && dataDateRange) {
      const end = new Date(dataDateRange.max);
      setEndDate(end);
      setStartDate(subYears(end, 1));
      setDatesInitialized(true);
    }
  }, [dataDateRange, datesInitialized]);

  useEffect(() => {
    if (allocations.length === 0 && portfolioNames.length > 0) {
      const first = portfolioNames[0];
      const w = getHoldings(first);
      if (w.length) {
        setAllocations(w);
        setBaselineWeights(Object.fromEntries(w.map((a) => [a.ticker, a.weight])));
        setLoadFromPortfolio(first);
      }
    }
  }, [portfolioNames, getHoldings, allocations.length]);
  const [overlayTickers, setOverlayTickers] = useState<string[]>([]);
  const [showPiecewise, setShowPiecewise] = useState(false);
  const [maxModels, setMaxModels] = useState(10);
  const [showAssets, setShowAssets] = useState(false);

  const totalWeight = allocations.reduce((s, a) => s + a.weight, 0);
  const isValid = Math.abs(totalWeight - 100) < 0.01 && allocations.length > 0;

  const chartData = useMemo(() => {
    if (!isValid) return [];
    return calculatePortfolioReturns(allocations, startDate, endDate, getSeries);
  }, [allocations, startDate, endDate, isValid, getSeries]);

  const overlaySeriesMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const t of overlayTickers) {
      const series = calculateCumulativeReturns(t, startDate, endDate, getSeries);
      if (!series.length) continue;
      const lookup: Record<string, number> = {};
      for (const p of series) lookup[p.date] = p.cumret;
      map[t] = lookup;
    }
    return map;
  }, [overlayTickers, startDate, endDate, getSeries]);

  const mergedData = useMemo(() => {
    if (overlayTickers.length === 0) return chartData;
    return chartData.map((row) => {
      const next: any = { ...row };
      for (const t of overlayTickers) {
        if (overlaySeriesMap[t]?.[row.date] != null) next[t] = overlaySeriesMap[t][row.date];
      }
      return next;
    });
  }, [chartData, overlayTickers, overlaySeriesMap]);

  const [portfolioFit, setPortfolioFit] = useState<number[]>([]);
  const [fitting, setFitting] = useState(false);

  useEffect(() => {
    if (!showPiecewise || mergedData.length < 10) {
      setPortfolioFit([]);
      return;
    }
    const controller = new AbortController();
    setFitting(true);
    fetchPiecewiseModel(mergedData.map((r) => r.portfolio), maxModels, 0.98, controller.signal)
      .then(({ model }) => {
        setPortfolioFit(model);
        setFitting(false);
      })
      .catch((e) => { if (e.name !== "AbortError") setFitting(false); });
    return () => controller.abort();
  }, [mergedData, showPiecewise, maxModels]);

  const piecewiseData = useMemo(() => {
    if (!portfolioFit.length) return mergedData;
    return mergedData.map((row, i) => ({ ...row, portfolio_fit: Math.round(portfolioFit[i] * 100) / 100 }));
  }, [mergedData, portfolioFit]);

  const displayData = showPiecewise ? piecewiseData : mergedData;
  const constituentTickers = allocations.map((a) => a.ticker);

  const summaryStats = useMemo<PortfolioStats[]>(() => {
    if (chartData.length < 2) return [];
    const dates = chartData.map((r) => r.date);
    const stats: PortfolioStats[] = [];
    const portfolioVals = chartData.map((r) => r.portfolio);
    const portfolioStats = computeStats("Portfolio", dates, portfolioVals, 3);
    stats.push(portfolioStats);
    for (const t of overlayTickers) {
      const lookup = overlaySeriesMap[t];
      if (!lookup) continue;
      const vals = dates.map((d) => lookup[d] ?? 0);
      stats.push(computeStatsRelativeDrawdowns(t, dates, vals, portfolioStats));
    }
    return stats;
  }, [chartData, overlayTickers, overlaySeriesMap]);

  const allVals: number[] = [];
  for (const row of displayData) {
    for (const [k, v] of Object.entries(row)) {
      if (k !== "date" && typeof v === "number") {
        if (!showAssets && constituentTickers.includes(k) && k !== "portfolio" && k !== "portfolio_fit" && !overlayTickers.includes(k)) continue;
        allVals.push(v);
      }
    }
  }
  const min = allVals.length ? Math.min(...allVals) : 0;
  const max = allVals.length ? Math.max(...allVals) : 10;
  const padding = (max - min) * 0.1 || 2;
  const tickInterval = Math.max(1, Math.floor(displayData.length / 8));

  const toggleOverlay = (t: string) => {
    setOverlayTickers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  if (loading) return <main className="container mx-auto px-4 py-10 text-muted-foreground">Loading data…</main>;
  if (error) return <main className="container mx-auto px-4 py-10 text-destructive">Error loading data: {error}</main>;

  return (
    <main className="container mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Portfolio Construction</h2>
          <p className="text-xs text-muted-foreground">What-if simulation in NZD — independent of actual holdings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {portfolioNames.length > 0 && (
            <div className="flex items-center gap-1">
              <Select value={loadFromPortfolio} onValueChange={setLoadFromPortfolio}>
                <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="From actual…" /></SelectTrigger>
                <SelectContent>
                  {portfolioNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={!loadFromPortfolio}
                onClick={() => {
                  const w = getHoldings(loadFromPortfolio);
                  if (w.length) {
                    setAllocations(w);
                    setBaselineWeights(Object.fromEntries(w.map((a) => [a.ticker, a.weight])));
                  }
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Load weights
              </Button>
            </div>
          )}
          <PortfolioSaveLoad allocations={allocations} onLoad={setAllocations} />
        </div>
      </div>

      <PortfolioAllocator
        allocations={allocations}
        onChange={setAllocations}
        baseline={baselineWeights}
        baselineLabel={loadFromPortfolio ? `${loadFromPortfolio} actual` : "Baseline"}
        onResetToBaseline={
          Object.keys(baselineWeights).length > 0
            ? () =>
                setAllocations(
                  Object.entries(baselineWeights).map(([ticker, weight]) => ({ ticker, weight }))
                )
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        <div className="flex items-center gap-4 flex-wrap">
          <ComparisonSelector primaryTicker="" compareTickers={overlayTickers} onToggle={toggleOverlay} />
          <div className="flex items-center gap-2">
            <label htmlFor="show-assets" className="text-xs text-muted-foreground whitespace-nowrap">Show Assets</label>
            <Switch id="show-assets" checked={showAssets} onCheckedChange={setShowAssets} />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="pw-fit" className="text-xs text-muted-foreground whitespace-nowrap">Piecewise Fit</label>
            <Switch id="pw-fit" checked={showPiecewise} onCheckedChange={setShowPiecewise} />
            {showPiecewise && (
              <input
                type="number"
                min={1}
                max={50}
                value={maxModels}
                onChange={(e) => setMaxModels(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="w-14 h-7 rounded-md border border-input bg-background px-2 text-xs text-center"
                title="Max segments"
              />
            )}
          </div>
        </div>
      </div>

      {!isValid ? (
        <Card>
          <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
            {allocations.length === 0 ? "Add assets to build a portfolio" : "Weights must sum to 100%"}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 pt-5">
            {fitting && <p className="text-xs text-muted-foreground text-right mb-1">Computing fit…</p>}
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "MMM yy")} interval={tickInterval} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis domain={[Math.floor(min - padding), Math.ceil(max + padding)]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} className="fill-muted-foreground" width={60} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg text-sm min-w-[140px]">
                        <div className="font-medium mb-1.5">{format(parseISO(label), "MMM d, yyyy")}</div>
                        {payload.map((entry: any) => (
                          <div key={entry.dataKey} className="flex justify-between gap-4 items-center">
                            <span style={{ color: entry.stroke }} className="font-semibold text-xs">{entry.dataKey.replace("_fit", " fit")}</span>
                            <span className="font-mono text-xs">{entry.value != null ? `${Number(entry.value).toFixed(2)}%` : "—"}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="portfolio" stroke="#16a34a" strokeWidth={2.5} dot={false} animationDuration={500} connectNulls />
                {showPiecewise && <Line type="linear" dataKey="portfolio_fit" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={false} animationDuration={500} connectNulls name="portfolio fit" />}
                {showAssets && constituentTickers.map((t, i) => (
                  <Line key={`constituent-${t}`} type="monotone" dataKey={t} stroke={CONSTITUENT_COLORS[i % CONSTITUENT_COLORS.length]} strokeWidth={1} strokeDasharray="2 2" dot={false} animationDuration={500} connectNulls name={`${t} (constituent)`} />
                ))}
                {overlayTickers.map((t, i) => (
                  <Line key={`compare-${t}`} type="monotone" dataKey={t} stroke={OVERLAY_COLORS[i % OVERLAY_COLORS.length]} strokeWidth={1.5} strokeDasharray="4 2" dot={false} animationDuration={500} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <PortfolioSummaryCards stats={summaryStats} />
    </main>
  );
};

export default Portfolio;
