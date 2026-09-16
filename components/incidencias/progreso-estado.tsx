import { CircleCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTADOS_INCIDENCIA,
  type EstadoIncidencia,
} from "@/lib/incidencias-visual";

/**
 * ProgresoEstado — timeline compacto del flujo de una incidencia
 * (concepto §30 del Plan Maestro). Versión base y visual; la timeline
 * detallada con fechas vive en components/shared/timeline.tsx.
 *
 * El flujo mostrado sigue el orden de la semilla 0005 y omite
 * "Cancelada" (fin alternativo, no parte del progreso normal).
 */

/** Secuencia de estados del progreso normal (sin "Cancelada"). */
const FLUJO: EstadoIncidencia[] = [
  "Pendiente",
  "Asignada",
  "En proceso",
  "En espera",
  "Resuelta",
  "Cerrada",
];

export function ProgresoEstado({
  estado,
  className,
}: {
  /** Estado actual de la incidencia. */
  estado: string | null | undefined;
  className?: string;
}) {
  const actual = (estado ?? "").trim();
  // "Cancelada" y estados desconocidos: se resalta "Pendiente" como punto de partida.
  const indiceActual = FLUJO.indexOf(actual as EstadoIncidencia);
  const indice = indiceActual === -1 ? 0 : indiceActual;

  return (
    <ol
      data-slot="progreso-estado"
      className={cn("flex flex-wrap items-center gap-x-1 gap-y-2", className)}
      aria-label="Progreso de la incidencia"
    >
      {FLUJO.map((nombre, i) => {
        const meta = ESTADOS_INCIDENCIA[nombre];
        const Icon: LucideIcon = i <= indice ? meta.icon : CircleCheck;
        const completado = i < indice;
        const activo = i === indice;

        return (
          <li key={nombre} className="flex items-center gap-1">
            {i > 0 ? (
              <span
                className={cn(
                  "mx-1 h-px w-4 sm:w-6",
                  i <= indice ? "bg-primary/60" : "bg-border"
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                activo
                  ? meta.clases
                  : completado
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground"
              )}
              aria-current={activo ? "step" : undefined}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {meta.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
