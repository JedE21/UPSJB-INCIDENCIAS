import { cn } from "@/lib/utils";
import { metaDeEstado, metaDePrioridad } from "@/lib/incidencias-visual";

/**
 * Badges de estado y prioridad de incidencias (§50 del Plan Maestro):
 * siempre ICONO + TEXTO; el color es un refuerzo, nunca el único indicador.
 */

export function StatusBadge({
  estado,
  className,
}: {
  estado: string | null | undefined;
  className?: string;
}) {
  const meta = metaDeEstado(estado);
  const Icon = meta.icon;

  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        meta.clases,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({
  prioridad,
  className,
}: {
  prioridad: string | null | undefined;
  className?: string;
}) {
  const meta = metaDePrioridad(prioridad);
  const Icon = meta.icon;

  return (
    <span
      data-slot="priority-badge"
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        meta.clases,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}
