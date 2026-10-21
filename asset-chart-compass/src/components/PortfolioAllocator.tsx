import { useData } from "@/contexts/DataContext";
import { Allocation } from "@/lib/portfolioCalc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  allocations: Allocation[];
  onChange: (allocations: Allocation[]) => void;
  readOnly?: boolean;
  /** Baseline weights for comparison/override workflow. Keyed by ticker -> weight %. */
  baseline?: Record<string, number>;
  baselineLabel?: string;
  onResetToBaseline?: () => void;
}

export function PortfolioAllocator({
  allocations, onChange, readOnly = false, baseline, baselineLabel = "Baseline", onResetToBaseline,
}: Props) {
  const { assets } = useData();
  const totalWeight = allocations.reduce((s, a) => s + a.weight, 0);
  const isValid = Math.abs(totalWeight - 100) < 0.01;
  const usedTickers = new Set(allocations.map((a) => a.ticker));
  const hasBaseline = !!baseline && Object.keys(baseline).length > 0;
  const baselineTotal = hasBaseline ? Object.values(baseline!).reduce((s, w) => s + w, 0) : 0;

  const addRow = () => {
    const available = assets.find((a) => !usedTickers.has(a.ticker));
    if (!available) return;
    onChange([...allocations, { ticker: available.ticker, weight: 0 }]);
  };

  const removeRow = (index: number) => onChange(allocations.filter((_, i) => i !== index));
  const updateTicker = (index: number, ticker: string) => {
    const next = [...allocations];
    next[index] = { ...next[index], ticker };
    onChange(next);
  };
  const updateWeight = (index: number, value: string) => {
    const w = parseFloat(value) || 0;
    const next = [...allocations];
    next[index] = { ...next[index], weight: Math.min(100, Math.max(0, w)) };
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[260px]">Asset</TableHead>
            {hasBaseline && <TableHead className="w-[110px] text-right">{baselineLabel}</TableHead>}
            <TableHead className="w-[140px] text-right">
              {hasBaseline ? "Your weight" : "Weight"}
            </TableHead>
            {hasBaseline && <TableHead className="w-[90px] text-right">Δ</TableHead>}
            {!readOnly && <TableHead className="w-[40px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((alloc, i) => {
            const baseW = baseline?.[alloc.ticker];
            const delta = baseW != null ? alloc.weight - baseW : undefined;
            return (
              <TableRow key={i}>
                <TableCell>
                  {readOnly ? (
                    <div className="text-sm">
                      <span className="font-semibold">{alloc.ticker}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {assets.find((a) => a.ticker === alloc.ticker)?.name ?? ""}
                      </span>
                    </div>
                  ) : (
                    <Select value={alloc.ticker} onValueChange={(v) => updateTicker(i, v)}>
                      <SelectTrigger className="w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((a) => (
                          <SelectItem
                            key={a.ticker}
                            value={a.ticker}
                            disabled={usedTickers.has(a.ticker) && a.ticker !== alloc.ticker}
                          >
                            <span className="font-semibold">{a.ticker}</span>
                            <span className="ml-2 text-muted-foreground text-xs">{a.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                {hasBaseline && (
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {baseW != null ? `${baseW.toFixed(1)}%` : "—"}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={alloc.weight}
                      disabled={readOnly}
                      onChange={(e) => updateWeight(i, e.target.value)}
                      className="w-20 text-right font-mono"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </TableCell>
                {hasBaseline && (
                  <TableCell
                    className={cn(
                      "text-right font-mono text-xs",
                      delta == null
                        ? "text-muted-foreground"
                        : Math.abs(delta) < 0.05
                        ? "text-muted-foreground"
                        : delta > 0
                        ? "text-green-600"
                        : "text-destructive"
                    )}
                  >
                    {delta == null ? "new" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                  </TableCell>
                )}
                {!readOnly && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center gap-3 flex-wrap px-3 pb-3">
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={addRow} disabled={usedTickers.size >= assets.length}>
            <Plus className="h-4 w-4 mr-1" /> Add Asset
          </Button>
        )}
        {hasBaseline && !readOnly && onResetToBaseline && (
          <Button variant="ghost" size="sm" onClick={onResetToBaseline}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset to {baselineLabel.toLowerCase()}
          </Button>
        )}
        <span className={`text-sm font-medium ml-auto ${isValid ? "text-green-600" : "text-destructive"}`}>
          Total: {totalWeight.toFixed(1)}%
          {hasBaseline && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              ({baselineLabel}: {baselineTotal.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
