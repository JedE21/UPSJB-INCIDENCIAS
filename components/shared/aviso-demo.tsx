import { Info } from "lucide-react";

/**
 * AvisoDemo — marca VISIBLE de que los datos mostrados son de ejemplo.
 * Se renderiza junto a cualquier maqueta que use lib/demo/datos-ejemplo.ts
 * mientras la lógica definitiva (Fase 6) no esté conectada.
 */
export function AvisoDemo({ className }: { className?: string }) {
  return (
    <p
      className={
        "flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground" +
        (className ? ` ${className}` : "")
      }
    >
      <Info className="size-3.5 shrink-0" aria-hidden />
      <span>
        Datos de ejemplo para previsualizar el diseño; no provienen de la base de datos.
      </span>
    </p>
  );
}
