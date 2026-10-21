import { cn } from "@/lib/utils";
import { UploadDialog } from "@/components/UploadDialog";
import { useData } from "@/contexts/DataContext";
import { WorkbookData } from "@/lib/dataLoader";
import { Badge } from "@/components/ui/badge";

export type AppTab = "monitoring" | "exploration" | "construction";

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: "monitoring", label: "Portfolio Monitoring" },
  { id: "exploration", label: "Asset Exploration" },
  { id: "construction", label: "Portfolio Construction" },
];

export function AppHeader({ activeTab, onTabChange }: Props) {
  const { loadUserData, assets, loading } = useData();

  const handleLoad = (data: WorkbookData) => {
    loadUserData(data);
  };

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center gap-6 py-3 px-4">
        <span className="text-lg font-bold tracking-tight">Portfolio Tools</span>
        <nav className="flex items-center gap-1 flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === t.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!loading && assets.length > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">
              {assets.filter(a => !a.is_benchmark).length} assets loaded
            </Badge>
          )}
          <UploadDialog onLoad={handleLoad} />
        </div>
      </div>
    </header>
  );
}
