import { CardsSkeleton } from "@/components/shared/loading-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * LOADING DEL PANEL ADMIN · Next.js lo muestra mientras el Server Component
 * de la ruta resuelve sus consultas (streaming SSR).
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando panel administrativo">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardsSkeleton cantidad={4} />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
