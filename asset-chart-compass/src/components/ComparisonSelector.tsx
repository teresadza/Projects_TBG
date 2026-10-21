import { useData } from "@/contexts/DataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const COMPARE_COLORS = [
  "#2563eb", "#d97706", "#7c3aed", "#0891b2", "#be123c", "#059669", "#e11d48", "#6366f1",
];

interface ComparisonSelectorProps {
  primaryTicker: string;
  compareTickers: string[];
  onToggle: (ticker: string) => void;
}

export function getCompareColor(index: number) {
  return COMPARE_COLORS[index % COMPARE_COLORS.length];
}

export function ComparisonSelector({ primaryTicker, compareTickers, onToggle }: ComparisonSelectorProps) {
  const { assets } = useData();
  const available = assets.filter((a) => a.ticker !== primaryTicker);

  // Group: Assets, Benchmarks, Portfolios
  const byType: Record<string, typeof assets> = { Asset: [], Benchmark: [], PortfolioNAV: [] };
  for (const a of available) (byType[a.asset_type] ||= []).push(a);
  const groupOrder: { key: string; label: string }[] = [
    { key: "Asset", label: "Assets" },
    { key: "Benchmark", label: "Benchmarks" },
    { key: "PortfolioNAV", label: "Portfolios" },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {compareTickers.map((t, i) => (
        <Badge
          key={t}
          variant="outline"
          className="cursor-pointer gap-1 pr-1"
          style={{ borderColor: getCompareColor(i), color: getCompareColor(i) }}
          onClick={() => onToggle(t)}
        >
          {t} ✕
        </Badge>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" /> Compare
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 max-h-[360px] overflow-y-auto" align="start">
          {groupOrder.map(({ key, label }) => {
            const list = byType[key] ?? [];
            if (!list.length) return null;
            return (
              <div key={key} className="mb-2 last:mb-0">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 px-2">
                  {label}
                </div>
                {list.map((a) => {
                  const isSelected = compareTickers.includes(a.ticker);
                  return (
                    <button
                      key={a.ticker}
                      onClick={() => onToggle(a.ticker)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                        isSelected && "bg-accent"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      <span className={cn("font-semibold", !isSelected && "ml-5")}>{a.ticker}</span>
                      <span className="text-muted-foreground text-xs truncate">{a.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
