/**
 * LOADING PROPIO DE /ADMIN/REPORTES (FASE 10 §"Loading"): esqueletos de
 * KPIs y gráficos mientras el servidor agrega en Postgres. El panel ya
 * tiene app/admin/error.tsx como error boundary — esta ruta lo hereda,
 * con loading específico para la primera carga.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function ReportesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando reportes">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>

      {/* KPIs operativos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      {/* KPIs de tiempo */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    </div>
  );
}
