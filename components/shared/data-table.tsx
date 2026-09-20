"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";

/**
 * DataTable — tabla genérica del lado cliente para listados de los paneles.
 * Búsqueda textual, orden por columna y paginación incluidos.
 * La protección de datos la hace RLS; esto es solo presentación.
 */

export interface DataTableColumn<T> {
  id: string;
  header: string;
  /** Extrae el contenido celda (texto o nodo); por defecto row[id]. */
  cell?: (row: T) => React.ReactNode;
  /** Valor textual usado por búsqueda y orden. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  /** React key por fila. */
  rowKey: (row: T) => string;
  /** Habilita búsqueda (por defecto true si alguna columna tiene value()). */
  searchable?: boolean;
  placeholderBusqueda?: string;
  /** Filas por página (10 por defecto). */
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  loading?: boolean;
  className?: string;
}

type Orden = { id: string; dir: "asc" | "desc" } | null;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchable,
  placeholderBusqueda,
  pageSize = 10,
  emptyTitle = "Sin resultados",
  emptyDescription,
  emptyIcon,
  loading = false,
  className,
}: DataTableProps<T>) {
  const [busqueda, setBusqueda] = React.useState("");
  const [orden, setOrden] = React.useState<Orden>(null);
  const [pagina, setPagina] = React.useState(1);

  const buscable = searchable ?? columns.some((c) => c.value);

  // Filtrado por búsqueda textual.
  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) => (c.value?.(row) ?? "").toString().toLowerCase().includes(q))
    );
  }, [rows, busqueda, columns]);

  // Ordenamiento.
  const ordenadas = React.useMemo(() => {
    if (!orden) return filtradas;
    const col = columns.find((c) => c.id === orden.id);
    if (!col?.value) return filtradas;
    const dir = orden.dir === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      const va = col.value!(a) ?? "";
      const vb = col.value!(b) ?? "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return va.toString().localeCompare(vb.toString(), "es") * dir;
    });
  }, [filtradas, orden, columns]);

  // Paginación (se resetea al cambiar la búsqueda).
  React.useEffect(() => setPagina(1), [busqueda]);
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / pageSize));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = ordenadas.slice(
    (paginaActual - 1) * pageSize,
    paginaActual * pageSize
  );

  const alternarOrden = (id: string) => {
    setOrden((prev) =>
      prev?.id !== id
        ? { id, dir: "asc" }
        : prev.dir === "asc"
          ? { id, dir: "desc" }
          : null
    );
  };

  if (loading) return <LoadingState className={className} />;

  if (ordenadas.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription ?? (busqueda ? "Ningún resultado coincide con tu búsqueda." : undefined)}
        className={className}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {buscable ? <SearchInput value={busqueda} onChange={setBusqueda} placeholder={placeholderBusqueda} /> : null}

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={col.className}
                aria-sort={
                  orden?.id === col.id
                    ? orden.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : col.sortable && col.value
                      ? "none"
                      : undefined
                }
              >
                {col.sortable && col.value ? (
                  <button
                    type="button"
                    onClick={() => alternarOrden(col.id)}
                    className="inline-flex min-h-8 items-center gap-1 rounded px-1 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={`Ordenar por ${col.header}`}
                  >
                    {col.header}
                    {orden?.id === col.id ? (
                      orden.dir === "asc" ? (
                        <ArrowUp className="size-3.5" aria-hidden />
                      ) : (
                        <ArrowDown className="size-3.5" aria-hidden />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.id} className={col.className}>
                  {col.cell ? col.cell(row) : ((col.value?.(row) ?? "") as React.ReactNode)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPaginas > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {ordenadas.length} registro{ordenadas.length !== 1 ? "s" : ""} · página {paginaActual} de {totalPaginas}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={paginaActual <= 1}
              onClick={() => setPagina((p) => p - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
