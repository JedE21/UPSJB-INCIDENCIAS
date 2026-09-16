"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { cerrarSesion } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/**
 * Menú de sesión del header de paneles.
 * Recibe nombre y rol principal ya resueltos en el servidor (layout guard);
 * el logout llama a la Server Action cerrarSesion (signOut + cookies limpias).
 */
export function MenuUsuario({
  nombre,
  rol,
  rutaPerfil = "/perfil",
}: {
  nombre: string;
  rol: string;
  rutaPerfil?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClickearFuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClickearFuera);
    return () => document.removeEventListener("mousedown", alClickearFuera);
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10">
          <User className="size-3.5 text-primary" aria-hidden />
        </span>
        <span className="hidden max-w-36 truncate sm:inline" title={nombre}>
          {nombre}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </button>

      {abierto ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border bg-popover shadow-md"
        >
          <div className="border-b px-3 py-2.5">
            <p className="truncate text-sm font-medium" title={nombre}>
              {nombre}
            </p>
            <p className="text-xs text-muted-foreground">Rol: {rol}</p>
          </div>

          <Link
            href={rutaPerfil}
            role="menuitem"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <User className="size-4" aria-hidden />
            Mi perfil
          </Link>

          <form action={cerrarSesion} className="border-t">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive transition-colors hover:bg-accent"
            >
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
