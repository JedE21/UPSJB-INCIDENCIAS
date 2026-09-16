import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Breadcrumbs — ruta de navegación jerárquica.
 * El último ítem se muestra como página actual (no es enlace).
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className={cn("mb-4", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const ultimo = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden /> : null}
              {item.href && !ultimo ? (
                <Link
                  href={item.href}
                  className="rounded px-1 py-0.5 transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={ultimo ? "page" : undefined}
                  className={cn("px-1 py-0.5", ultimo && "font-medium text-foreground")}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
