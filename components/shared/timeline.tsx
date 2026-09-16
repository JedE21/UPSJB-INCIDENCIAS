import { CircleCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Timeline — línea de tiempo visual para el seguimiento de una incidencia
 * (concepto §30 del Plan Maestro). Genérica: el componente ProgresoEstado
 * muestra el flujo compacto; esta muestra el historial detallado.
 */

export interface TimelineHito {
  title: string;
  description?: string;
  /** Fecha/hora en texto (formateada por el servidor o el cliente). */
  fecha?: string;
  icon?: LucideIcon;
  /** done: hito cumplido · current: en curso · pending: por venir. */
  estado?: "done" | "current" | "pending";
}

export function Timeline({
  hitos,
  className,
}: {
  hitos: TimelineHito[];
  className?: string;
}) {
  if (hitos.length === 0) return null;

  return (
    <ol data-slot="timeline" className={cn("relative flex flex-col gap-6", className)}>
      {hitos.map((hito, i) => {
        const estado = hito.estado ?? (i < hitos.length - 1 ? "done" : "current");
        const Icon = hito.icon ?? CircleCheck;
        const ultimo = i === hitos.length - 1;

        return (
          <li key={`${hito.title}-${i}`} className="relative flex gap-3">
            {/* Línea vertical conectora */}
            {!ultimo ? (
              <span
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-8px)] w-px",
                  estado === "pending" ? "bg-border" : "bg-primary/40"
                )}
                aria-hidden
              />
            ) : null}

            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
                estado === "done" && "border-primary/30 bg-primary/10 text-primary",
                estado === "current" && "border-primary bg-primary text-primary-foreground",
                estado === "pending" && "border-border bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>

            <div className="flex min-w-0 flex-col gap-0.5 pt-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  estado === "pending" && "text-muted-foreground"
                )}
              >
                {hito.title}
              </p>
              {hito.fecha ? (
                <p className="text-xs text-muted-foreground">{hito.fecha}</p>
              ) : null}
              {hito.description ? (
                <p className="text-sm text-muted-foreground">{hito.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
