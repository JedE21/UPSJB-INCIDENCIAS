import { cn } from "@/lib/utils";

/**
 * FilterBar — contenedor responsive para búsqueda + filtros.
 * Coloca SearchInput y Selects (de components/ui/select.tsx) como children.
 */
export function FilterBar({
  search,
  filters,
  className,
}: {
  /** Campo de búsqueda (SearchInput) u otro elemento a la izquierda. */
  search?: React.ReactNode;
  /** Selects u otros filtros a la derecha. */
  filters?: React.ReactNode;
  className?: string;
}) {
  if (!search && !filters) return null;

  return (
    <div
      data-slot="filter-bar"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {search ? <div className="w-full sm:w-auto">{search}</div> : null}
      {filters ? (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      ) : null}
    </div>
  );
}
