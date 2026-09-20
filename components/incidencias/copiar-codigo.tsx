"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

/**
 * CopiarCodigo — copia el código de incidencia al portapapeles con feedback
 * visual inmediato (icono ✓ + texto «Copiado»). No depende del long-press del
 * sistema (§49: feedback de acciones, táctil amigable).
 */
export function CopiarCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = React.useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Portapapeles no disponible (permisos/http): el código sigue visible
      // con select-all para copia manual.
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      className={
        "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none " +
        (copiado
          ? "border-green-300 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-950 dark:text-green-300"
          : "text-muted-foreground hover:bg-accent hover:text-foreground")
      }
      aria-live="polite"
      aria-label={copiado ? "Código copiado al portapapeles" : `Copiar código ${codigo}`}
    >
      {copiado ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}
