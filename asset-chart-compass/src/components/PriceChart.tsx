import { useEffect, useMemo, useState } from "react";
import { PricePoint } from "@/lib/priceSeries";
import { fetchPiecewiseModel } from "@/lib/piecewiseApi";
import { Card, CardContent } from "@/components/ui/card";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { getCompareColor } from "./ComparisonSelector";

interface SeriesData {
  ticker: string;
  data: PricePoint[];
}

interface PriceChartProps {
  data: PricePoint[];
  ticker: string;
  compareSeries?: SeriesData[];
  normalized?: boolean;
  showPiecewise?: boolean;
  maxModels?: number;
}

function createTooltip(isNormalized: boolean) {
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg text-sm min-w-[140px]">
        <div className="font-medium mb-1.5">{format(parseISO(label), "MMM d, yyyy")}</div>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex justify-between gap-4 items-center">
            <span style={{ color: entry.stroke }} className="font-semibold text-xs">{entry.dataKey}</span>
            <span className="font-mono text-xs">
              {entry.value != null
                ? isNormalized
                  ? `${Number(entry.value).toFixed(2)}%`
                  : `${Number(entry.value).toFixed(2)}`
                : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  };
}

export function PriceChart({ data, ticker, compareSeries = [], normalized = false, showPiecewise = false, maxModels = 10 }: PriceChartProps) {
  const isComparing = compareSeries.length > 0;

  const [fitRows, setFitRows] = useState<Record<string, number>[]>([]);
  const [fitKeys, setFitKeys] = useState<string[]>([]);
  const [fitting, setFitting] = useState(false);

  const { sortedEntries, allTickers, chartData } = useMemo(() => {
    const merged: Record<string, Record<string, number>> = {};
    for (const d of data) {
      if (!merged[d.date]) merged[d.date] = {};
      merged[d.date][ticker] = d.price;
    }
    for (const s of compareSeries) {
      for (const d of s.data) {
        if (!merged[d.date]) merged[d.date] = {};
        merged[d.date][s.ticker] = d.price;
      }
    }

    const sortedEntries = Object.entries(merged).sort(([a], [b]) => a.localeCompare(b));
    const allTickers = [ticker, ...compareSeries.map((s) => s.ticker)];

    const cumretLookup: Record<string, Record<string, number>> = {};
    if (normalized) {
      for (const t of allTickers) {
        const lookup: Record<string, number> = {};
        let factor = 1;
        let prev: number | null = null;
        for (const [date, values] of sortedEntries) {
          const price = values[t];
          if (price == null) continue;
          if (prev != null && prev !== 0) factor *= price / prev;
          prev = price;
          lookup[date] = (factor - 1) * 100;
        }
        cumretLookup[t] = lookup;
      }
    }

    const chartData = sortedEntries.map(([date, values]) => {
      const row: Record<string, any> = { date };
      for (const t of allTickers) {
        if (values[t] == null) continue;
        if (normalized) {
          const cr = cumretLookup[t]?.[date];
          if (cr != null) row[t] = Math.round(cr * 100) / 100;
        } else {
          row[t] = values[t];
        }
      }
      return row;
    });

    return { sortedEntries, allTickers, chartData };
  }, [data, ticker, compareSeries, normalized]);

  useEffect(() => {
    if (!showPiecewise || !chartData.length) {
      setFitRows([]);
      setFitKeys([]);
      return;
    }

    const controller = new AbortController();

    const dateToIdx: Record<string, number> = {};
    chartData.forEach((row, idx) => { dateToIdx[row.date] = idx; });

    const tasks: { t: string; cumRet: number[]; rowIdxs: number[]; firstPrice: number | null }[] = [];

    for (const t of allTickers) {
      const points = t === ticker
        ? data.map((p) => ({ date: p.date, price: p.price }))
        : (compareSeries.find((s) => s.ticker === t)?.data ?? []).map((p) => ({ date: p.date, price: p.price }));

      const validPoints = points.filter((p) => dateToIdx[p.date] !== undefined);
      if (validPoints.length < 10) continue;

      const cumRet: number[] = [];
      const rowIdxs: number[] = [];
      let factor = 1;
      let prev: number | null = null;
      for (const { date, price } of validPoints) {
        if (prev !== null && prev !== 0) factor *= price / prev;
        prev = price;
        cumRet.push((factor - 1) * 100);
        rowIdxs.push(dateToIdx[date]);
      }

      tasks.push({ t, cumRet, rowIdxs, firstPrice: normalized ? null : validPoints[0].price });
    }

    if (!tasks.length) return;

    setFitting(true);

    Promise.all(
      tasks.map(({ t, cumRet, rowIdxs, firstPrice }) =>
        fetchPiecewiseModel(cumRet, maxModels, 0.98, controller.signal)
          .then(({ model }) => ({ t, model, rowIdxs, firstPrice }))
      )
    ).then((results) => {
      if (controller.signal.aborted) return;

      const newRows: Record<string, number>[] = Array.from({ length: chartData.length }, () => ({}));
      const newKeys: string[] = [];

      for (const { t, model, rowIdxs, firstPrice } of results) {
        const key = `${t}_fit`;
        newKeys.push(key);
        for (let i = 0; i < rowIdxs.length; i++) {
          newRows[rowIdxs[i]][key] = normalized
            ? Math.round(model[i] * 100) / 100
            : firstPrice != null
              ? Math.round(firstPrice * (1 + model[i] / 100) * 100) / 100
              : model[i];
        }
      }

      setFitRows(newRows);
      setFitKeys(newKeys);
      setFitting(false);
    }).catch((e) => {
      if (e.name !== "AbortError") setFitting(false);
    });

    return () => controller.abort();
  }, [showPiecewise, chartData, maxModels, normalized, data, ticker, compareSeries, allTickers]);

  const displayData = useMemo(() => {
    if (!fitRows.length) return chartData;
    return chartData.map((row, i) => ({ ...row, ...fitRows[i] }));
  }, [chartData, fitRows]);

  if (!data.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
          No data for selected range
        </CardContent>
      </Card>
    );
  }

  const allPrices: number[] = [];
  for (const row of displayData) {
    for (const [k, v] of Object.entries(row)) {
      if (k !== "date" && typeof v === "number") allPrices.push(v);
    }
  }
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const padding = (max - min) * 0.1 || 5;

  const first = data[0].price;
  const last = data[data.length - 1].price;
  const isPositive = normalized ? (chartData[chartData.length - 1]?.[ticker] ?? 0) >= 0 : last >= first;
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));
  const primaryColor = isPositive ? "#16a34a" : "#dc2626";

  const tickerColorMap: Record<string, string> = { [ticker]: primaryColor };
  compareSeries.forEach((s, i) => { tickerColorMap[s.ticker] = getCompareColor(i); });

  return (
    <Card>
      <CardContent className="p-4 pt-5">
        {fitting && (
          <p className="text-xs text-muted-foreground text-right mb-1">Computing fit…</p>
        )}
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => format(parseISO(v), "MMM yy")}
              interval={tickInterval}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              domain={[Math.floor(min - padding), Math.ceil(max + padding)]}
              tickFormatter={(v) => normalized ? `${v}%` : `${v}`}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              width={65}
            />
            <Tooltip content={createTooltip(normalized)} />
            {isComparing && <Legend />}
            <Line type="monotone" dataKey={ticker} stroke={primaryColor} strokeWidth={2} dot={false} animationDuration={500} connectNulls />
            {compareSeries.map((s, i) => (
              <Line key={s.ticker} type="monotone" dataKey={s.ticker} stroke={getCompareColor(i)} strokeWidth={2} dot={false} animationDuration={500} connectNulls />
            ))}
            {fitKeys.map((key) => {
              const t = key.replace("_fit", "");
              const color = tickerColorMap[t] ?? primaryColor;
              return <Line key={key} type="linear" dataKey={key} stroke={color} strokeWidth={1.5} strokeDasharray="2 4" dot={false} animationDuration={500} connectNulls name={key.replace("_fit", " fit")} />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
