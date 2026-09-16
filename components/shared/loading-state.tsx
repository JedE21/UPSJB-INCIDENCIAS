import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * LoadingState — estado de carga con spinner y mensaje.
 * Complementos de skeleton para tablas y grillas de tarjetas.
 */
export function LoadingState({
  message = "Cargando…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-3 py-14 text-center", className)}
    >
      <Spinner className="size-6 text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Skeleton de filas de tabla (altura aproximada de <Table />). */
export function TableSkeleton({ filas = 5, columnas = 4 }: { filas?: number; columnas?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: filas }).map((_, f) => (
        <div key={f} className="flex gap-2">
          {Array.from({ length: columnas }).map((_, c) => (
            <Skeleton key={c} className="h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton de grilla de tarjetas (para StatCard y similares). */
export function CardsSkeleton({
  cantidad = 4,
  className,
}: {
  cantidad?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
      aria-hidden
    >
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} className="rounded-xl border p-5">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      ))}
    </div>
  );
}
