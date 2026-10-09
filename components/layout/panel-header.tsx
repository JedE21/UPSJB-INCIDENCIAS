"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { LogoUpsjb } from "@/components/layout/logo-upsjb";
import { contextNav, type AppContext } from "@/lib/navigation";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

type PanelContext = Exclude<AppContext, "public">;

export function PanelHeader({
  context,
  children,
  /** El panel admin usa sidebar a la izquierda: header solo en móvil. */
  conSidebar = false,
}: {
  context: PanelContext;
  /** Acciones a la derecha (menú de usuario / sesión). */
  children?: ReactNode;
  conSidebar?: boolean;
}) {
  const pathname = usePathname();
  const items = contextNav[context];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-seguro sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Volver al inicio"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <LogoUpsjb className="hidden h-8 sm:block" />
        </Link>

        <nav
          className={cn(
            "ml-auto hidden items-center gap-1 md:flex",
            conSidebar && "lg:hidden"
          )}
          aria-label={`Navegación ${context}`}
        >
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {children}
          <span className="rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:hidden">
            {context}
          </span>
        </div>
      </div>

      <nav className="overflow-x-auto border-t md:hidden" aria-label={`Navegación ${context} móvil`}>
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-seguro py-2">
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "border-primary/30 bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
