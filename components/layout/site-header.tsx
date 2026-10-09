"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuUsuario } from "@/components/auth/menu-usuario";
import { loginNavItem, publicNav } from "@/lib/navigation";
import { LogoUpsjb } from "@/components/layout/logo-upsjb";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader({
  sesion,
}: {
  /** Sesión resuelta en el layout (servidor). Si existe, se muestra el menú de usuario. */
  sesion?: { nombre: string; rol: string; rutaPerfil?: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-seguro sm:gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Inicio">
          <LogoUpsjb className="h-9" />
          <span className="sr-only">
            {siteConfig.name} — {siteConfig.institution}
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          {publicNav.map((item) => {
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
          {sesion ? (
            <div className="ml-2">
              <MenuUsuario
                nombre={sesion.nombre}
                rol={sesion.rol}
                rutaPerfil={sesion.rutaPerfil}
              />
            </div>
          ) : (
            <Button asChild size="sm" className="ml-2">
              <Link href={loginNavItem.href}>
                <loginNavItem.icon className="size-4" aria-hidden />
                {loginNavItem.label}
              </Link>
            </Button>
          )}
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {open && (
        <nav
          className="border-t bg-background px-seguro pb-seguro pt-3 md:hidden"
          aria-label="Navegación principal móvil"
        >
          <ul className="flex flex-col gap-1">
            {publicNav.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2 border-t pt-2">
              {sesion ? (
                <div className="flex flex-col gap-2">
                  <MenuUsuario
                    nombre={sesion.nombre}
                    rol={sesion.rol}
                    rutaPerfil={sesion.rutaPerfil}
                  />
                </div>
              ) : (
                <Button asChild className="w-full">
                  <Link href={loginNavItem.href} onClick={() => setOpen(false)}>
                    <loginNavItem.icon className="size-4" aria-hidden />
                    {loginNavItem.label}
                  </Link>
                </Button>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
