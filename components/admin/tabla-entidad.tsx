"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { SearchInput } from "@/components/shared/search-input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { FormularioEntidad, type ReferenciasEntidad } from "@/components/admin/formulario-entidad";
import { alternarEntidad } from "@/lib/admin/acciones";
import type { EntidadAdmin, FilaEntidad } from "@/lib/admin/entidades";
import { Alert } from "@/components/ui/alert";

/**
 * TABLA CRUD GENÉRICA · SIR-UPSJB (FASE 7)
 *
 * Recibe filas ya cargadas en servidor (RLS filtradas), aplica búsqueda y
 * filtros del lado cliente, y expone crear/editar/activar-desactivar con
 * confirmación. El borrado físico no existe en el modelo (docs/01 §2.7).
 */
export function TablaEntidad({
  entidad,
  filas,
  referencias,
  errorCarga,
}: {
  entidad: EntidadAdmin;
  filas: FilaEntidad[];
  referencias?: ReferenciasEntidad;
  /** Mensaje si la carga en servidor falló (p. ej. permisos). */
  errorCarga?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [busqueda, setBusqueda] = React.useState("");
  const [filtros, setFiltros] = React.useState<Record<string, string>>({});
  const [filaToggle, setFilaToggle] = React.useState<FilaEntidad | null>(null);
  const [procesando, setProcesando] = React.useState(false);

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((fila) => {
      for (const filtro of entidad.filtros ?? []) {
        const valor = filtros[filtro.key] ?? "todos";
        if (valor === "todos" || valor === "todas") continue;
        if (filtro.estatico) {
          // Genérico: el value de la opción es el valor esperado del campo
          // ("activos"→true, "inactivos"→false, texto comparado tal cual).
          const valorFila = fila[filtro.campo];
          if (valor === "activos") {
            if (valorFila !== true) return false;
          } else if (valor === "inactivos") {
            if (valorFila !== false) return false;
          } else {
            const texto =
              valorFila === null || valorFila === undefined ? "" : String(valorFila).toLowerCase();
            if (texto !== valor.toLowerCase()) return false;
          }
        } else if (filtro.referencia) {
          // Filtros jerárquicos comparan etiquetas de jerarquía.
          const etiquetas = (fila.jerarquia ?? []).map((e) => e.toLowerCase());
          const esperado = valor.toLowerCase();
          if (!etiquetas.includes(esperado)) return false;
        }
      }
      if (!q) return true;
      const texto = (entidad.columnas ?? [])
        .map((c) => {
          if (c.value) return String(c.value(fila) ?? "");
          const v = fila[c.id];
          return v === null || v === undefined ? "" : String(v);
        })
        .join(" ")
        .toLowerCase();
      return texto.includes(q);
    });
  }, [filas, busqueda, filtros, entidad]);

  const columnas = React.useMemo(
    () => [
      ...entidad.columnas,
      ...(entidad.tieneActivo
        ? [
            {
              id: "estado",
              header: "Estado",
              value: (fila: FilaEntidad) => (fila.activo ? "Activo" : "Inactivo"),
              cell: (fila: FilaEntidad) =>
                fila.activo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/15 dark:text-gray-300">
                    <CircleSlash className="size-3.5" aria-hidden />
                    Inactivo
                  </span>
                ),
            },
          ]
        : []),
      {
        id: "acciones",
        header: "Acciones",
        className: "text-right",
        cell: (fila: FilaEntidad) => (
          <div className="flex justify-end">
            <FormularioEntidad entidad={entidad} fila={fila} referencias={referencias} />
            {entidad.tieneActivo ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFilaToggle(fila)}
                aria-label={fila.activo ? "Desactivar registro" : "Activar registro"}
                title={fila.activo ? "Desactivar" : "Activar"}
                className={fila.activo ? "text-destructive hover:text-destructive" : "text-green-700 hover:text-green-700"}
              >
                {fila.activo ? <CircleSlash aria-hidden /> : <CheckCircle2 aria-hidden />}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [entidad, referencias]
  );

  const alternar = async () => {
    if (!filaToggle) return;
    setProcesando(true);
    const fd = new FormData();
    fd.set("__entidad", entidad.slug);
    fd.set(
      "__id",
      entidad.claveCompuesta
        ? JSON.stringify(
            Object.fromEntries(entidad.claveCompuesta.map((c) => [c, String(filaToggle[c] ?? "")]))
          )
        : filaToggle.id
    );
    fd.set("__nuevo_estado", String(!filaToggle.activo));
    let res;
    try {
      res = await alternarEntidad(null, fd);
    } catch {
      res = { error: "No se pudo completar la operación." };
    }
    setProcesando(false);
    if (res.error) {
      toast({ title: "No se completó la operación", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: res.exito ?? "Estado actualizado", variant: "success" });
    setFilaToggle(null);
    router.refresh();
  };

  const etiquetaFila = (fila: FilaEntidad): string => {
    const primera = entidad.columnas[0];
    if (primera?.value) return String(primera.value(fila) ?? "");
    return String(fila[primera?.id ?? "id"] ?? "");
  };

  if (errorCarga) {
    return (
      <Alert variant="destructive">
        <p className="font-medium">No se pudieron cargar los registros</p>
        <p>{errorCarga}</p>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder={entidad.buscarPlaceholder}
            className="sm:w-72"
          />
        }
        filters={
          <>
            {(entidad.filtros ?? []).map((filtro) => {
              const valor = filtros[filtro.key] ?? "todos";
              return (
                <Select
                  key={filtro.key}
                  value={valor}
                  onChange={(e) => setFiltros((f) => ({ ...f, [filtro.key]: e.target.value }))}
                  aria-label={filtro.label}
                  className="w-48"
                >
                  {filtro.estatico ? (
                    filtro.estatico.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="todos">Todos</option>
                      {(referencias?.[filtro.referencia ?? ""] ?? []).map((ref) => (
                        <option key={ref.id} value={ref.nombre}>
                          {ref.nombre}
                        </option>
                      ))}
                    </>
                  )}
                </Select>
              );
            })}
            <FormularioEntidad entidad={entidad} referencias={referencias} />
          </>
        }
      />

      {filas.length === 0 ? (
        <EmptyState
          icon={entidad.icono}
          title={`Aún no hay ${entidad.titulo.toLowerCase()}`}
          description={`Crea el primer registro con el botón «Nuevo». Las reglas de negocio se validan en la base de datos.`}
        />
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description="Ningún registro coincide con la búsqueda o los filtros aplicados."
        />
      ) : (
        <DataTable
          columns={columnas}
          rows={filtradas}
          rowKey={(f) =>
            entidad.claveCompuesta
              ? entidad.claveCompuesta.map((c) => String(f[c] ?? "")).join("::")
              : f.id
          }
          searchable={false}
          pageSize={10}
          emptyIcon={entidad.icono}
          emptyTitle={`Aún no hay ${entidad.titulo.toLowerCase()}`}
        />
      )}

      {/* Confirmación de activar/desactivar */}
      <ConfirmDialog
        open={filaToggle !== null}
        onClose={() => setFilaToggle(null)}
        onConfirm={alternar}
        title={filaToggle?.activo ? "Desactivar registro" : "Activar registro"}
        description={
          filaToggle
            ? filaToggle.activo
              ? `«${etiquetaFila(filaToggle)}» dejará de estar disponible para los flujos del sistema (reporte, asignación, etc.). Sus datos y referencias históricas se conservan.`
              : `«${etiquetaFila(filaToggle)}» volverá a estar disponible para los flujos del sistema.`
            : ""
        }
        confirmLabel={filaToggle?.activo ? "Desactivar" : "Activar"}
        destructive={Boolean(filaToggle?.activo)}
        loading={procesando}
      />
    </div>
  );
}
