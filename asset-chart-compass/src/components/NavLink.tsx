import { NavLink as RouterNavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <RouterNavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )
      }
    >
      {children}
    </RouterNavLink>
  );
}
