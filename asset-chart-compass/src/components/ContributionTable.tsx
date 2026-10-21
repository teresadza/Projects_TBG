import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Allocation, calculateCumulativeReturns } from "@/lib/portfolioCalc";
import { useData } from "@/contexts/DataContext";
import { useMemo } from "react";

interface Props {
  allocations: Allocation[];
  startDate: Date;
  endDate: Date;
}

export function ContributionTable({ allocations, startDate, endDate }: Props) {
  const { getSeries, getAsset } = useData();

  const rows = useMemo(() => {
    return allocations.map((a) => {
      const series = calculateCumulativeReturns(a.ticker, startDate, endDate, getSeries);
      const ret = series.length ? series[series.length - 1].cumret : 0;
      const contribution = (a.weight / 100) * ret;
      return {
        ticker: a.ticker,
        name: getAsset(a.ticker)?.name ?? a.ticker,
        weight: a.weight,
        ret,
        contribution: Math.round(contribution * 100) / 100,
      };
    });
  }, [allocations, startDate, endDate, getSeries, getAsset]);

  const total = rows.reduce((s, r) => s + r.contribution, 0);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Contribution Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-xs">
          <div className="grid grid-cols-12 gap-2 font-medium text-muted-foreground border-b pb-2 mb-2">
            <div className="col-span-4">Asset</div>
            <div className="col-span-2 text-right">Weight</div>
            <div className="col-span-3 text-right">Asset Return</div>
            <div className="col-span-3 text-right">Contribution</div>
          </div>
          {rows.map((r) => (
            <div key={r.ticker} className="grid grid-cols-12 gap-2 py-1 items-center">
              <div className="col-span-4">
                <span className="font-semibold">{r.ticker}</span>
                <span className="ml-2 text-muted-foreground truncate">{r.name}</span>
              </div>
              <div className="col-span-2 text-right font-mono">{r.weight.toFixed(1)}%</div>
              <div className={`col-span-3 text-right font-mono ${r.ret >= 0 ? "text-green-600" : "text-red-600"}`}>
                {r.ret >= 0 ? "+" : ""}{r.ret.toFixed(2)}%
              </div>
              <div className={`col-span-3 text-right font-mono font-semibold ${r.contribution >= 0 ? "text-green-600" : "text-red-600"}`}>
                {r.contribution >= 0 ? "+" : ""}{r.contribution.toFixed(2)}%
              </div>
            </div>
          ))}
          <div className="grid grid-cols-12 gap-2 pt-2 mt-2 border-t font-semibold">
            <div className="col-span-9 text-right">Total Portfolio Return</div>
            <div className={`col-span-3 text-right font-mono ${total >= 0 ? "text-green-600" : "text-red-600"}`}>
              {total >= 0 ? "+" : ""}{total.toFixed(2)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
