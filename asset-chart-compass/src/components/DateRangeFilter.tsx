import { format, subDays, subMonths, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangeFilterProps {
  startDate: Date;
  endDate: Date;
  onStartChange: (d: Date) => void;
  onEndChange: (d: Date) => void;
}

const PRESETS = [
  { label: "1D", fn: () => subDays(new Date(), 1) },
  { label: "1W", fn: () => subDays(new Date(), 7) },
  { label: "1M", fn: () => subMonths(new Date(), 1) },
  { label: "3M", fn: () => subMonths(new Date(), 3) },
  { label: "1Y", fn: () => subYears(new Date(), 1) },
  { label: "All", fn: () => subYears(new Date(), 5) },
];

export function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.label}
          variant="outline"
          size="sm"
          onClick={() => {
            onStartChange(p.fn());
            onEndChange(new Date());
          }}
        >
          {p.label}
        </Button>
      ))}

      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {format(startDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(d) => d && onStartChange(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground text-sm">→</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {format(endDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(d) => d && onEndChange(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
