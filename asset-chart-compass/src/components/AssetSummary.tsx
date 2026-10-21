import { PricePoint } from "@/lib/priceSeries";
import { AssetMeta } from "@/lib/dataLoader";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface AssetSummaryProps {
  asset: AssetMeta;
  data: PricePoint[];
}

export function AssetSummary({ asset, data }: AssetSummaryProps) {
  if (!data.length) return null;

  const latest = data[data.length - 1];
  const first = data[0];
  const totalChange = latest.price - first.price;
  const totalChangePercent = first.price !== 0 ? (totalChange / first.price) * 100 : 0;
  const isPositive = totalChange >= 0;
  const sparkData = data.slice(-30);

  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
        <div className="flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{asset.ticker}</h2>
            <span className="text-sm text-muted-foreground">{asset.name}</span>
            {asset.asset_class && (
              <span className="text-xs rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                {asset.asset_class}
              </span>
            )}
            {asset.sector && (
              <span className="text-xs text-muted-foreground">{asset.sector}</span>
            )}
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl font-bold">{latest.price.toFixed(2)} {asset.currency}</span>
            <span className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? "+" : ""}
              {totalChange.toFixed(2)} ({totalChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="w-32 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? "#16a34a" : "#dc2626"} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={isPositive ? "#16a34a" : "#dc2626"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="price" stroke={isPositive ? "#16a34a" : "#dc2626"} fill="url(#sparkGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
