import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export function AppFooter() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">Prototype</Badge>
          <span>
            Portfolio analytics sandbox — monitor, explore assets, and build what-if portfolios.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/about" className="hover:text-foreground transition-colors">
            About
          </Link>
          <a
            href="mailto:teresa@blupointanalytics.co.nz"
            className="hover:text-foreground transition-colors"
          >
            teresa@blupointanalytics.co.nz
          </a>
        </div>
      </div>
    </footer>
  );
}
