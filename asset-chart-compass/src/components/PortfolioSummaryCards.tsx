import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioStats } from "@/lib/portfolioStats";
import { cn } from "@/lib/utils";

interface PortfolioSummaryCardsProps {
  stats: PortfolioStats[];
}

function StatValue({ value, suffix = "%" }: { value: number; suffix?: string }) {
  return (
    <span className={cn("font-mono text-sm font-semibold", value >= 0 ? "text-green-500" : "text-red-500")}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}

function fmtDate(d: string) {
  return format(parseISO(d), "MMM d, yy");
}

export function PortfolioSummaryCards({ stats }: PortfolioSummaryCardsProps) {
  if (stats.length === 0) return null;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">{s.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="text-muted-foreground">Total Return</div>
              <div className="text-right"><StatValue value={s.totalReturn} /></div>

              <div className="text-muted-foreground">Ann. Return</div>
              <div className="text-right"><StatValue value={s.annualizedReturn} /></div>

              <div className="text-muted-foreground">Ann. Volatility</div>
              <div className="text-right">
                <span className="font-mono text-sm font-semibold">{s.annualizedVol.toFixed(2)}%</span>
              </div>
            </div>

            {s.maxDrawdowns.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5 font-medium">{s.drawdownLabel || "Largest Drawdowns"}</div>
                <div className="space-y-1">
                  {s.maxDrawdowns.map((dd, i) => (
                    <div key={i} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-muted-foreground truncate">
                        {fmtDate(dd.peak)} → {fmtDate(dd.trough)}
                        {dd.recovery && <span className="opacity-60"> (rec {fmtDate(dd.recovery)})</span>}
                      </span>
                      <span className="font-mono font-semibold text-red-500 whitespace-nowrap">
                        {dd.drawdown.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
