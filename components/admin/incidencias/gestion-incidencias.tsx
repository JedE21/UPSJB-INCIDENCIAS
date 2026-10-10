"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { SearchInput } from "@/components/shared/search-input";
import { Select } from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/incidencias/badges";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { Alert } from "@/components/ui/alert";
import {
  actualizarIncidenciaAdmin,
  crearIncidenciaAdmin,
  eliminarIncidenciaAdmin,
} from "@/lib/admin/datos-incidencias";
import type {
  CatalogosIncidenciasAdmin,
  IncidenciaAdminFila,
} from "@/lib/admin/tipos-incidencias";

/**
 * GESTIÓN TOTAL DE INCIDENCIAS (cliente) · FASE 7
 * Tabla con filtros + modales de crear/editar + eliminación destructiva con
 * confirmación. Las Server Actions revalidan rol admin; RLS y las RPC 0022
 * imponen la decisión final en PostgreSQL.
 */

const ESTADOS = [
  "Pendiente",
  "Asignada",
  "En proceso",
  "En espera",
  "Resuelta",
  "Cerrada",
  "Cancelada",
  "Derivada",
] as const;


export function GestionIncidenciasAdmin({
  filas,
  errorCarga,
}: {
  filas: IncidenciaAdminFila[];
  errorCarga: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [busqueda, setBusqueda] = React.useState("");
  const [estadoFiltro, setEstadoFiltro] = React.useState("todos");
  const [filaEditar, setFilaEditar] = React.useState<IncidenciaAdminFila | null>(null);
  const [filaEliminar, setFilaEliminar] = React.useState<IncidenciaAdminFila | null>(null);
  const [modalCrear, setModalCrear] = React.useState(false);

  // Catálogos cargados AL DEMANDA (la página no los necesita hasta abrir un modal).
  const [catalogos, setCatalogos] = React.useState<CatalogosIncidenciasAdmin | null>(null);
  const cargarCatalogos = React.useCallback(async () => {
    if (catalogos) return;
    const res = await fetch("/api/admin/catalogos-incidencias", { cache: "no-store" });
    if (res.ok) {
      setCatalogos((await res.json()) as CatalogosIncidenciasAdmin);
    }
  }, [catalogos]);

  const alAbrirCrear = () => {
    void cargarCatalogos();
    setModalCrear(true);
  };
  const alAbrirEditar = (fila: IncidenciaAdminFila) => {
    void cargarCatalogos();
    setFilaEditar(fila);
  };

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (estadoFiltro !== "todos" && f.estado !== estadoFiltro) return false;
      if (!q) return true;
      const texto = [
        f.codigo, f.tipo, f.subtipo, f.ambiente, f.ambiente_codigo,
        f.sede, f.pabellon, f.reportante, f.area_responsable,
        f.tecnico_asignado, f.descripcion,
      ].join(" ").toLowerCase();
      return texto.includes(q);
    });
  }, [filas, busqueda, estadoFiltro]);

  const columnas = React.useMemo(
    () => [
      {
        id: "codigo",
        header: "Código",
        value: (f: IncidenciaAdminFila) => f.codigo,
        cell: (f: IncidenciaAdminFila) => (
          <Link
            href={`/seguimiento?codigo=${encodeURIComponent(f.codigo)}`}
            className="font-mono text-xs font-semibold hover:underline"
          >
            {f.codigo}
          </Link>
        ),
      },
      {
        id: "tipo",
        header: "Tipo",
        value: (f: IncidenciaAdminFila) => `${f.tipo} ${f.subtipo}`.trim(),
        cell: (f: IncidenciaAdminFila) => (
          <span className="text-sm">
            {f.tipo}
            {f.subtipo ? <span className="text-muted-foreground"> · {f.subtipo}</span> : null}
          </span>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        value: (f: IncidenciaAdminFila) => f.estado,
        cell: (f: IncidenciaAdminFila) => <StatusBadge estado={f.estado} />,
      },
      {
        id: "prioridad",
        header: "Prioridad",
        value: (f: IncidenciaAdminFila) => f.prioridad,
        cell: (f: IncidenciaAdminFila) => <PriorityBadge prioridad={f.prioridad} />,
      },
      {
        id: "ambiente",
        header: "Ambiente",
        value: (f: IncidenciaAdminFila) => [f.sede, f.pabellon, f.ambiente].filter(Boolean).join(" · "),
        cell: (f: IncidenciaAdminFila) => (
          <span className="max-w-[240px] truncate text-sm">
            {[f.ambiente, f.sede].filter(Boolean).join(" · ") || "—"}
          </span>
        ),
      },
      {
        id: "responsable",
        header: "Responsable",
        value: (f: IncidenciaAdminFila) => `${f.area_responsable} ${f.tecnico_asignado}`,
        cell: (f: IncidenciaAdminFila) => (
          <span className="text-xs text-muted-foreground">
            {[f.area_responsable, f.tecnico_asignado].filter(Boolean).join(" · ") || "—"}
          </span>
        ),
      },
      {
        id: "reportante",
        header: "Reportante",
        value: (f: IncidenciaAdminFila) => f.reportante,
        cell: (f: IncidenciaAdminFila) => (
          <span className="text-sm">{f.reportante || "—"}</span>
        ),
      },
      {
        id: "acciones",
        header: "Acciones",
        className: "text-right",
        cell: (f: IncidenciaAdminFila) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${f.codigo}`}
              title="Editar"
              onClick={() => alAbrirEditar(f)}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label={`Eliminar ${f.codigo}`}
              title="Eliminar"
              onClick={() => setFilaEliminar(f)}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Eliminación (destructiva, confirmada).
  const [eliminando, setEliminando] = React.useState(false);
  const eliminarConfirmado = async () => {
    if (!filaEliminar) return;
    setEliminando(true);
    const fd = new FormData();
    fd.set("_id", filaEliminar.id);
    let res;
    try {
      res = await eliminarIncidenciaAdmin(null, fd);
    } catch {
      res = { error: "No se pudo completar la operación." };
    }
    setEliminando(false);
    if (res.error) {
      toast({ title: "No se completó la operación", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: `Incidencia ${filaEliminar.codigo} eliminada`,
      description: "El evento quedó registrado en la auditoría.",
      variant: "success",
    });
    setFilaEliminar(null);
    router.refresh();
  };

  if (errorCarga) {
    return (
      <Alert variant="destructive">
        <p className="font-medium">No se pudieron cargar las incidencias</p>
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
            placeholder="Buscar por código, ambiente, reportante…"
            className="sm:w-80"
          />
        }
        filters={
          <>
            <Select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              aria-label="Filtrar por estado"
              className="w-44"
            >
              <option value="todos">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            <Button onClick={alAbrirCrear}>
              <Plus aria-hidden />
              Nueva incidencia
            </Button>
          </>
        }
      />

      {filas.length === 0 ? (
        <EmptyState
          title="Aún no hay incidencias"
          description="Cuando lleguen reportes (QR o web) y al crear una desde aquí, aparecerán en esta tabla."
        />
      ) : filtradas.length === 0 ? (
        <EmptyState title="Sin resultados" description="Ninguna incidencia coincide con la búsqueda o el filtro." />
      ) : (
        <DataTable
          columns={columnas}
          rows={filtradas}
          rowKey={(f) => f.id}
          searchable={false}
          pageSize={10}
        />
      )}

      {/* Modal CREAR */}
      {modalCrear ? (
        <ModalFormIncidencia
          titulo="Nueva incidencia"
          descripcion="Se registrará a nombre de tu cuenta. El código único y el estado inicial los asigna la base de datos."
          catalogos={catalogos}
          onClose={() => setModalCrear(false)}
          onGuardar={async (datos) => {
            const fd = new FormData();
            fd.set("ambiente_id", datos.ambiente_id);
            fd.set("tipo_incidencia_id", datos.tipo_incidencia_id);
            fd.set("subtipo_incidencia_id", datos.subtipo_incidencia_id);
            fd.set("prioridad_id", datos.prioridad_id);
            fd.set("descripcion", datos.descripcion);
            const res = await crearIncidenciaAdmin(null, fd);
            if (!res.error) {
              toast({
                title: `Incidencia creada${res.codigo ? ` (${res.codigo})` : ""}`,
                variant: "success",
              });
              setModalCrear(false);
              router.refresh();
            }
            return res;
          }}
        />
      ) : null}

      {/* Modal EDITAR */}
      {filaEditar ? (
        <ModalFormIncidencia
          titulo={`Editar — ${filaEditar.codigo}`}
          descripcion="El estado no se cambia aquí: siga el flujo de atención (derivar/asignar/estados). Los cambios quedan en el historial y la auditoría."
          catalogos={catalogos}
          valoresIniciales={{
            ambiente_id: "",
            tipo_incidencia_id: "",
            subtipo_incidencia_id: "",
            prioridad_id: "",
            descripcion: filaEditar.descripcion,
            contexto: filaEditar,
          }}
          onClose={() => setFilaEditar(null)}
          onGuardar={async (datos) => {
            const fd = new FormData();
            fd.set("_id", filaEditar.id);
            fd.set("descripcion", datos.descripcion);
            fd.set("tipo_incidencia_id", datos.tipo_incidencia_id);
            fd.set("subtipo_incidencia_id", datos.subtipo_incidencia_id);
            fd.set("_quitar_subtipo", datos.quitarSubtipo ? "1" : "0");
            fd.set("prioridad_id", datos.prioridad_id);
            fd.set("ambiente_id", datos.ambiente_id);
            const res = await actualizarIncidenciaAdmin(null, fd);
            if (!res.error) {
              toast({ title: "Cambios guardados", variant: "success" });
              setFilaEditar(null);
              router.refresh();
            }
            return res;
          }}
        />
      ) : null}

      <ConfirmDialog
        open={filaEliminar !== null}
        onClose={() => (eliminando ? undefined : setFilaEliminar(null))}
        onConfirm={eliminarConfirmado}
        title="Eliminar incidencia"
        description={
          filaEliminar
            ? `Se eliminará DEFINITIVAMENTE la incidencia ${filaEliminar.codigo}, con su historial, comentarios, evidencias y asignaciones. La acción queda registrada en la auditoría y no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar definitivamente"
        destructive
        loading={eliminando}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal crear/editar (catalogos cargados al abrir)                    */
/* ------------------------------------------------------------------ */

interface DatosForm {
  ambiente_id: string;
  tipo_incidencia_id: string;
  subtipo_incidencia_id: string;
  prioridad_id: string;
  descripcion: string;
  quitarSubtipo: boolean;
  /** Al editar: tipo/prioridad/ambiente vigentes de la fila (para precargar select). */
  contexto?: IncidenciaAdminFila | null;
}

function ModalFormIncidencia({
  titulo,
  descripcion: descripcionModal,
  catalogos,
  valoresIniciales,
  onClose,
  onGuardar,
}: {
  titulo: string;
  descripcion: string;
  catalogos: CatalogosIncidenciasAdmin | null;
  valoresIniciales?: Partial<DatosForm>;
  onClose: () => void;
  onGuardar: (datos: DatosForm) => Promise<{ error: string | null }>;
}) {
  const esEdicion = Boolean(valoresIniciales?.contexto);
  const ctx = valoresIniciales?.contexto ?? null;

  const [ambienteId, setAmbienteId] = React.useState("");
  const [tipoId, setTipoId] = React.useState("");
  const [subtipoId, setSubtipoId] = React.useState("");
  const [quitarSubtipo, setQuitarSubtipo] = React.useState(false);
  const [prioridadId, setPrioridadId] = React.useState("");
  const [descripcion, setDescripcion] = React.useState(valoresIniciales?.descripcion ?? "");
  const [enviando, setEnviando] = React.useState(false);
  const [errorForm, setErrorForm] = React.useState<string | null>(null);
  const { toast } = useToast();

  // Precarga del contexto de fila editada cuando los catálogos llegan.
  React.useEffect(() => {
    if (!catalogos || !ctx) return;
    // La fila plana no trae ids; se resuelven por nombre contra los catálogos.
    const ambiente = catalogos.ambientes.find(
      (a) => a.nombre === ctx.ambiente || a.nombre === ctx.ambiente_codigo
    );
    const tipo = catalogos.tipos.find((t) => t.nombre === ctx.tipo);
    const subtipo = catalogos.subtipos.find((s) => s.nombre === ctx.subtipo);
    const prioridad = catalogos.prioridades.find((p) => p.nombre === ctx.prioridad);
    setAmbienteId(ambiente?.id ?? "");
    setTipoId(tipo?.id ?? "");
    setSubtipoId(subtipo?.id ?? "");
    setPrioridadId(prioridad?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogos]);

  if (!catalogos) {
    return (
      <Modal open onClose={onClose} title={titulo} description="Cargando catálogos…">
        <div className="flex justify-center py-8">
          <Spinner className="text-current" />
        </div>
      </Modal>
    );
  }

  const subtiposDelTipo = catalogos.subtipos.filter((s) => s.tipo_incidencia_id === tipoId);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErrorForm(null);
    let res;
    try {
      res = await onGuardar({
        ambiente_id: ambienteId,
        tipo_incidencia_id: tipoId,
        subtipo_incidencia_id: subtipoId,
        prioridad_id: prioridadId,
        descripcion,
        quitarSubtipo,
        contexto: ctx,
      });
    } catch {
      res = { error: "No se pudo completar la operación. Intenta nuevamente." };
    }
    setEnviando(false);
    if (res.error) setErrorForm(res.error);
  };

  return (
    <Modal
      open
      onClose={() => (enviando ? undefined : onClose())}
      title={titulo}
      description={descripcionModal}
      size="lg"
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        {errorForm ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          >
            {errorForm}
          </p>
        ) : null}

        <FormField label="Ambiente" htmlFor="inc-ambiente" required={!esEdicion}>
          <Select
            id="inc-ambiente"
            value={ambienteId}
            onChange={(e) => setAmbienteId(e.target.value)}
            disabled={enviando}
          >
            <option value="">{esEdicion ? "Sin cambio" : "Selecciona el ambiente…"}</option>
            {catalogos.ambientes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
                {a.activo === false ? " (inactivo)" : ""}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tipo de incidencia" htmlFor="inc-tipo" required={!esEdicion}>
            <Select
              id="inc-tipo"
              value={tipoId}
              onChange={(e) => {
                setTipoId(e.target.value);
                setSubtipoId("");
              }}
              disabled={enviando}
            >
              <option value="">{esEdicion ? "Sin cambio" : "Selecciona el tipo…"}</option>
              {catalogos.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {t.activo === false ? " (inactivo)" : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Subtipo (opcional)" htmlFor="inc-subtipo">
            <Select
              id="inc-subtipo"
              value={quitarSubtipo ? "" : subtipoId}
              onChange={(e) => setSubtipoId(e.target.value)}
              disabled={enviando || !tipoId}
            >
              <option value="">{esEdicion ? "Sin cambio" : "Sin subtipo"}</option>
              {subtiposDelTipo.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                  {s.activo === false ? " (inactivo)" : ""}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Prioridad (opcional)" htmlFor="inc-prioridad">
            <Select
              id="inc-prioridad"
              value={prioridadId}
              onChange={(e) => setPrioridadId(e.target.value)}
              disabled={enviando}
            >
              <option value="">{esEdicion ? "Sin cambio" : "Por defecto (Media)"}</option>
              {catalogos.prioridades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.activo === false ? " (inactivo)" : ""}
                </option>
              ))}
            </Select>
          </FormField>
          {esEdicion ? (
            <label className="flex items-end gap-2 pb-2 text-sm" htmlFor="inc-quitar-subtipo">
              <input
                id="inc-quitar-subtipo"
                type="checkbox"
                checked={quitarSubtipo}
                onChange={(e) => setQuitarSubtipo(e.target.checked)}
                className="size-4 rounded border-input accent-[var(--primary)]"
              />
              Quitar el subtipo actual
            </label>
          ) : null}
        </div>

        <FormField
          label="Descripción"
          htmlFor="inc-descripcion"
          required={!esEdicion}
          hint="Entre 10 y 2000 caracteres."
        >
          <Textarea
            id="inc-descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            maxLength={2000}
            disabled={enviando}
          />
        </FormField>
        <p className="-mt-2 text-right text-[11px] text-muted-foreground">{descripcion.length}/2000</p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? <Spinner className="text-current" /> : null}
            {esEdicion ? "Guardar cambios" : "Crear"}
          </Button>
        </div>
      </form>
      <Label className="sr-only">Formulario de incidencia</Label>
      <Input className="sr-only" readOnly value="" />
    </Modal>
  );
}
