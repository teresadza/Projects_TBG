import { useData } from "@/contexts/DataContext";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssetSelectorProps {
  selected: string;
  onSelect: (ticker: string) => void;
}

export function AssetSelector({ selected, onSelect }: AssetSelectorProps) {
  const { assets } = useData();
  // Group by asset_class
  const groups: Record<string, typeof assets> = {};
  for (const a of assets) {
    const k = a.asset_class || "Other";
    (groups[k] ||= []).push(a);
  }

  return (
    <Select value={selected} onValueChange={onSelect}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select an asset" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groups).map(([cls, list]) => (
          <SelectGroup key={cls}>
            <SelectLabel>{cls}</SelectLabel>
            {list.map((a) => (
              <SelectItem key={a.ticker} value={a.ticker}>
                <span className="font-semibold">{a.ticker}</span>
                <span className="ml-2 text-muted-foreground">{a.name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
