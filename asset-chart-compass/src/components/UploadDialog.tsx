import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadWorkbookFromFile, loadWorkbookFromCsvFiles, WorkbookData } from "@/lib/dataLoader";

const CSV_SHEETS = ["assets", "prices", "fx_rates", "portfolio_holdings", "benchmarks"] as const;
type SheetName = typeof CSV_SHEETS[number];

interface Props {
  onLoad: (data: WorkbookData) => void;
}

export function UploadDialog({ onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"xlsx" | "csv">("xlsx");
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [csvFiles, setCsvFiles] = useState<Partial<Record<SheetName, File>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const xlsxRef = useRef<HTMLInputElement>(null);
  const csvRefs = useRef<Partial<Record<SheetName, HTMLInputElement>>>({});

  const reset = () => {
    setXlsxFile(null);
    setCsvFiles({});
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  const handleXlsxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setXlsxFile(f);
    setError(null);
    setSuccess(false);
  };

  const handleCsvChange = (sheet: SheetName) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setCsvFiles((prev) => f ? { ...prev, [sheet]: f } : { ...prev, [sheet]: undefined });
    setError(null);
    setSuccess(false);
  };

  const csvReady = CSV_SHEETS.every((s) => csvFiles[s]);

  const handleLoad = async () => {
    setError(null);
    setLoading(true);
    try {
      let data: WorkbookData;
      if (mode === "xlsx") {
        if (!xlsxFile) throw new Error("Please select an XLSX file.");
        data = await loadWorkbookFromFile(xlsxFile);
      } else {
        if (!csvReady) throw new Error("Please select all 5 CSV files.");
        data = await loadWorkbookFromCsvFiles(csvFiles as Record<SheetName, File>);
      }
      onLoad(data);
      setSuccess(true);
      setTimeout(() => setOpen(false), 800);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const SHEET_LABELS: Record<SheetName, string> = {
    assets: "assets.csv",
    prices: "prices.csv",
    fx_rates: "fx_rates.csv",
    portfolio_holdings: "portfolio_holdings.csv",
    benchmarks: "benchmarks.csv",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Load data
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Load portfolio data</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => { setMode("xlsx"); reset(); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
              mode === "xlsx"
                ? "bg-accent text-accent-foreground border-accent"
                : "text-muted-foreground border-border hover:bg-accent/40"
            }`}
          >
            Single XLSX
          </button>
          <button
            onClick={() => { setMode("csv"); reset(); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
              mode === "csv"
                ? "bg-accent text-accent-foreground border-accent"
                : "text-muted-foreground border-border hover:bg-accent/40"
            }`}
          >
            CSV files
          </button>
        </div>

        {mode === "xlsx" ? (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Upload your <code className="text-xs">portfolio_data.xlsx</code> file — must contain sheets:{" "}
              <span className="font-medium text-foreground">assets, prices, fx_rates, portfolio_holdings, benchmarks</span>.
            </p>
            <div
              onClick={() => xlsxRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors"
            >
              <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              {xlsxFile ? (
                <div className="flex items-center justify-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {xlsxFile.name}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Click to select .xlsx file</p>
              )}
            </div>
            <input ref={xlsxRef} type="file" accept=".xlsx" className="hidden" onChange={handleXlsxChange} />
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground mb-3">
              Upload one CSV per sheet — column headers must match the expected schema.
            </p>
            {CSV_SHEETS.map((sheet) => {
              const file = csvFiles[sheet];
              return (
                <div
                  key={sheet}
                  onClick={() => csvRefs.current[sheet]?.click()}
                  className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
                >
                  <span className="text-xs font-mono text-muted-foreground">{SHEET_LABELS[sheet]}</span>
                  {file ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {file.name}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs">Select</Badge>
                  )}
                  <input
                    ref={(el) => { if (el) csvRefs.current[sheet] = el; }}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCsvChange(sheet)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-3">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-md p-3">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Data loaded successfully!
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleLoad}
            disabled={loading || (mode === "xlsx" ? !xlsxFile : !csvReady)}
          >
            {loading ? "Loading…" : "Load"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
