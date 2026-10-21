import { useState, useEffect } from "react";
import { Allocation } from "@/lib/portfolioCalc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, FolderOpen, Trash2 } from "lucide-react";

const STORAGE_KEY = "saved_portfolios";

export interface SavedPortfolio {
  name: string;
  allocations: Allocation[];
}

function loadAll(): SavedPortfolio[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(portfolios: SavedPortfolio[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
}

interface Props {
  allocations: Allocation[];
  onLoad: (allocations: Allocation[]) => void;
}

export function PortfolioSaveLoad({ allocations, onLoad }: Props) {
  const [saved, setSaved] = useState<SavedPortfolio[]>(loadAll);
  const [name, setName] = useState("");
  const [selectedName, setSelectedName] = useState<string>("");

  useEffect(() => {
    setSaved(loadAll());
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    const next = saved.filter((p) => p.name !== name.trim());
    next.push({ name: name.trim(), allocations });
    saveAll(next);
    setSaved(next);
    setName("");
  };

  const handleLoad = () => {
    const found = saved.find((p) => p.name === selectedName);
    if (found) onLoad(found.allocations);
  };

  const handleDelete = () => {
    const next = saved.filter((p) => p.name !== selectedName);
    saveAll(next);
    setSaved(next);
    setSelectedName("");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        placeholder="Portfolio name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-[160px] h-9 text-sm"
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />
      <Button variant="outline" size="sm" onClick={handleSave} disabled={!name.trim()}>
        <Save className="h-3.5 w-3.5 mr-1" /> Save
      </Button>

      {saved.length > 0 && (
        <>
          <Select value={selectedName} onValueChange={setSelectedName}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Load portfolio…" />
            </SelectTrigger>
            <SelectContent>
              {saved.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleLoad} disabled={!selectedName}>
            <FolderOpen className="h-3.5 w-3.5 mr-1" /> Load
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={!selectedName}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
