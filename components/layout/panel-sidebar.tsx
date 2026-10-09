"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { contextNav, type AppContext } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type PanelContext = Exclude<AppContext, "public">;

/**
 * BARRA LATERAL de navegación (lista vertical) del panel admin.
 * Replica los mismos items de contextNav de lib/navigation (única fuente).
 * Visible solo en ≥ lg (el header móvil mantiene la lista horizontal).
 */
export function PanelSidebar({ context }: { context: PanelContext }) {
  const pathname = usePathname();
  const items = contextNav[context];

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label={`Navegación ${context}`}>
      <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Administración
      </p>
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
