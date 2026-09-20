"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  DoorOpen,
  FileText,
  Film,
  ImageIcon,
  MapPin,
  MessageSquare,
  Paperclip,
  Route,
  Search,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { Timeline } from "@/components/shared/timeline";
import { ProgresoEstado } from "@/components/incidencias/progreso-estado";
import { PriorityBadge, StatusBadge } from "@/components/incidencias/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { agregarComentario, eliminarEvidencia } from "@/lib/incidencias/actions";
import { fechaHora } from "@/lib/fechas";
import { tamanoLegible } from "@/lib/incidencias/formato";
import { PanelSla } from "@/components/incidencias/panel-sla";
import type { SlaDetalle } from "@/lib/incidencias/sla-formato";
import type { EvidenciaItem, HistorialItem, IncidenciaDetalle } from "@/lib/incidencias/tipos";

const PATRON_CODIGO = "INC-AAAA-NNNNNN";

/** Etiquetas legibles por tipo de cambio del historial (ck_incidencia_historial_tipo). */
const ETIQUETAS_HISTORIAL: Record<string, string> = {
  estado: "Cambio de estado",
  prioridad: "Cambio de prioridad",
  asignacion: "Asignación",
  derivacion: "Derivación",
  edicion: "Edición",
  cierre: "Cierre",
  cancelacion: "Cancelación",
  otro: "Actualización",
};

const ETIQUETAS_EVIDENCIA: Record<string, string> = {
  antes: "Foto antes",
  durante: "Foto durante",
  despues: "Foto después",
  documento: "Documento",
  video: "Video",
};

/** Icono y descripción por tipo de evidencia (§50: icono + texto). */
function metaEvidencia(tipo: string, mime: string) {
  if (mime.startsWith("image/")) return { icon: ImageIcon, esImagen: true };
  if (mime === "video/mp4") return { icon: Film, esImagen: false };
  return { icon: FileText, esImagen: false };
}

export function VistaSeguimiento({
  codigoInicial,
  incidencia,
  sla = null,
  puedeComentar = false,
  puedeAdjuntar = false,
  falloServicio = false,
}: {
  codigoInicial?: string;
  /** Resultado de la consulta en servidor (null = no visible o inexistente). */
  incidencia: IncidenciaDetalle | null;
  /** Estado SLA calculado en BD (RPC 0017); null = sin acceso o sin SLA. */
  sla?: SlaDetalle | null;
  /** true si el lector puede comentar (dueño/técnico/admin con permiso). */
  puedeComentar?: boolean;
  /** true si el lector puede adjuntar evidencias (permiso adjuntar_evidencia). */
  puedeAdjuntar?: boolean;
  /** true = la consulta no pudo completarse (BD no disponible): mensaje de reintento. */
  falloServicio?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [codigo, setCodigo] = React.useState(codigoInicial ?? "");
  const [error, setError] = React.useState<string | null>(null);

  // Comentarios
  const [comentario, setComentario] = React.useState("");
  const [enviandoComentario, setEnviandoComentario] = React.useState(false);

  // Eliminación de evidencias (solo admin: la RPC lo impone en servidor).
  const [porEliminar, setPorEliminar] = React.useState<EvidenciaItem | null>(null);
  const [eliminando, setEliminando] = React.useState(false);

  const consultado = Boolean(codigoInicial);

  const alConsultar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valor = codigo.trim().toUpperCase();
    if (!/^INC-\d{4}-\d{4,6}$/.test(valor)) {
      setError(`El código tiene el formato ${PATRON_CODIGO}. Ej.: INC-2026-00128.`);
      return;
    }
    setError(null);
    router.push(`/seguimiento?codigo=${encodeURIComponent(valor)}`);
  };

  const alComentar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!incidencia) return;
    const texto = comentario.trim();
    if (!texto) return;

    setEnviandoComentario(true);
    try {
      const res = await agregarComentario(incidencia.id, texto);
      if (res.error) {
        toast({ title: "No se pudo comentar", description: res.error, variant: "destructive" });
      } else {
        setComentario("");
        toast({ title: "Comentario publicado", variant: "success" });
        router.refresh();
      }
    } catch {
      toast({
        title: "Error de conexión",
        description: "Verifica tu red e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setEnviandoComentario(false);
    }
  };

  const alEliminarEvidencia = async () => {
    if (!porEliminar || !incidencia) return;
    setEliminando(true);
    try {
      const res = await eliminarEvidencia(porEliminar.id);
      if (res.error) {
        toast({ title: "No se pudo eliminar", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Evidencia eliminada", variant: "success" });
        setPorEliminar(null);
        router.refresh();
      }
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Buscador por código */}
      <Card>
        <CardContent>
          <form onSubmit={alConsultar} noValidate className="flex flex-col gap-3">
            <div>
              <Label htmlFor="codigo-seguimiento">Código de incidencia</Label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="codigo-seguimiento"
                  name="codigo"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="INC-2026-00128"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "codigo-seguimiento-error" : undefined}
                  className="font-mono uppercase"
                />
                <Button type="submit" className="shrink-0">
                  <Search aria-hidden />
                  Consultar
                </Button>
              </div>
              {error ? (
                <p id="codigo-seguimiento-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Formato: {PATRON_CODIGO} · lo recibiste al enviar tu reporte.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resultado */}
      {incidencia ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="font-mono text-xl">{incidencia.codigo}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge estado={incidencia.estado} />
                <PriorityBadge prioridad={incidencia.prioridad} />
              </div>
            </div>
            <CardDescription>
              {incidencia.tipo}
              {incidencia.subtipo ? ` · ${incidencia.subtipo}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Información relevante */}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <DoorOpen className="size-3.5" aria-hidden />
                  Ambiente
                </dt>
                <dd className="mt-0.5 font-medium">{incidencia.ambiente_nombre}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Fecha de reporte
                </dt>
                <dd className="mt-0.5 font-medium">{fechaHora(incidencia.fecha_reporte)}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:col-span-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden />
                  Ubicación
                </dt>
                <dd className="mt-0.5 font-medium">
                  {[incidencia.sede, incidencia.pabellon, incidencia.piso, incidencia.tipo_ambiente]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
              {incidencia.area_responsable ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Route className="size-3.5" aria-hidden />
                    Área responsable
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {incidencia.area_responsable}
                    {incidencia.servicio_responsable ? ` · ${incidencia.servicio_responsable}` : ""}
                  </dd>
                </div>
              ) : null}
              {incidencia.tecnico_asignado ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Wrench className="size-3.5" aria-hidden />
                    Técnico asignado
                  </dt>
                  <dd className="mt-0.5 font-medium">{incidencia.tecnico_asignado}</dd>
                </div>
              ) : null}
              {incidencia.reportante ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <User className="size-3.5" aria-hidden />
                    Reportado por
                  </dt>
                  <dd className="mt-0.5 font-medium">{incidencia.reportante}</dd>
                </div>
              ) : null}
              <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:col-span-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="size-3.5" aria-hidden />
                  Descripción
                </dt>
                <dd className="mt-0.5 whitespace-pre-line">{incidencia.descripcion}</dd>
              </div>
            </dl>

            {/* Equipo relacionado (si la incidencia lo registró) */}
            {incidencia.equipos.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Equipo relacionado</h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {incidencia.equipos.map((eq) => (
                    <li
                      key={eq.id}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <span className="font-mono text-xs">{eq.codigo_interno}</span>
                      <span className="text-xs text-muted-foreground">
                        {eq.categoria ?? "Equipo"}
                        {eq.es_principal ? " · principal" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Progreso del flujo (§30) */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Estado del reporte</h3>
              <ProgresoEstado estado={incidencia.estado} />
            </div>

            {/* SLA (Fase 8b): objetivos y estado calculados en BD */}
            <PanelSla sla={sla} />

            {/* Evidencias (Storage privado; URLs firmadas de corta duración) */}
            <Evidencias
              evidencias={incidencia.adjuntos}
              puedeEliminar={incidencia.adjuntos.some((a) => a.puede_eliminar)}
              onEliminar={(ev) => setPorEliminar(ev)}
            />

            {/* Comentarios */}
            <Comentarios
              comentarios={incidencia.comentarios}
              puedeComentar={puedeComentar}
              comentario={comentario}
              setComentario={setComentario}
              enviando={enviandoComentario}
              onEnviar={alComentar}
            />

            {/* Historial (append-only) — Timeline visual */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Historial</h3>
              {incidencia.historial.length > 0 ? (
                <Timeline hitos={aHitos(incidencia.historial)} />
              ) : (
                <Timeline
                  hitos={[
                    {
                      title: "Reportada",
                      description: "El usuario registró la incidencia.",
                      fecha: fechaHora(incidencia.fecha_reporte),
                      estado: "done" as const,
                    },
                  ]}
                />
              )}
            </div>

            {/* Acción útil siguiente */}
            <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Wrench className="size-3.5 shrink-0" aria-hidden />
              Cuando la incidencia pase a “Resuelta” podrás confirmar si la solución fue
              satisfactoria.
            </p>
          </CardContent>
        </Card>
      ) : falloServicio ? (
        <EmptyState
          title="No se pudo completar la consulta"
          description="Tuvimos un problema temporal al verificar el código. Revisa tu conexión e inténtalo nuevamente en unos segundos."
        />
      ) : consultado ? (
        <EmptyState
          title="Incidencia no encontrada"
          description={`No hay resultados para ${codigoInicial}. Verifica el código e inténtalo de nuevo; si reportaste esta incidencia, inicia sesión con la cuenta que la registró.`}
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Ingresa un código para ver el estado del reporte.
        </p>
      )}

      {/* Confirmación de eliminación de evidencia (solo admin la ve) */}
      <ConfirmDialog
        open={Boolean(porEliminar)}
        onClose={() => (eliminando ? undefined : setPorEliminar(null))}
        onConfirm={alEliminarEvidencia}
        title="Eliminar evidencia"
        description={
          porEliminar
            ? `Se eliminará definitivamente “${porEliminar.nombre_archivo}” del repositorio privado. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        destructive
        loading={eliminando}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Evidencias                                                          */
/* ------------------------------------------------------------------ */

function Evidencias({
  evidencias,
  puedeEliminar,
  onEliminar,
}: {
  evidencias: IncidenciaDetalle["adjuntos"];
  puedeEliminar: boolean;
  onEliminar: (ev: EvidenciaItem) => void;
}) {
  if (evidencias.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Paperclip className="size-4" aria-hidden />
        Evidencias ({evidencias.length})
      </h3>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {evidencias.map((ev) => {
          const { icon: Icon, esImagen } = metaEvidencia(ev.tipo, ev.mime_type);
          return (
            <li key={ev.id} className="overflow-hidden rounded-lg border bg-muted/30">
              <div className="relative">
                {esImagen && ev.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ev.url}
                    alt={`Evidencia: ${ev.nombre_archivo}`}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <Icon className="size-7" aria-hidden />
                    <span className="px-2 text-center text-xs">{ETIQUETAS_EVIDENCIA[ev.tipo] ?? "Evidencia"}</span>
                  </div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                  {ETIQUETAS_EVIDENCIA[ev.tipo] ?? ev.tipo}
                </span>
              </div>
              <div className="flex flex-col gap-1 px-2.5 py-2">
                <p className="truncate text-xs font-medium" title={ev.nombre_archivo}>
                  {ev.nombre_archivo}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {tamanoLegible(ev.tamano_bytes)}
                  {ev.subido_por ? ` · ${ev.subido_por}` : ""}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {ev.url ? (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Ver / descargar
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground" title="Sin acceso o enlace expirado">
                      Sin acceso
                    </span>
                  )}
                  {puedeEliminar && ev.puede_eliminar ? (
                    <button
                      type="button"
                      onClick={() => onEliminar(ev)}
                      className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
                      aria-label={`Eliminar ${ev.nombre_archivo}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Los archivos se sirven desde un repositorio privado mediante enlaces temporales
        (5 minutos). Recarga la página si un enlace expiró.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comentarios                                                         */
/* ------------------------------------------------------------------ */

function Comentarios({
  comentarios,
  puedeComentar,
  comentario,
  setComentario,
  enviando,
  onEnviar,
}: {
  comentarios: IncidenciaDetalle["comentarios"];
  puedeComentar: boolean;
  comentario: string;
  setComentario: (v: string) => void;
  enviando: boolean;
  onEnviar: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <MessageSquare className="size-4" aria-hidden />
        Comentarios ({comentarios.length})
      </h3>

      {comentarios.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {comentarios.map((c) => (
            <li key={c.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span className="text-xs font-medium">{c.autor ?? "Usuario"}</span>
                <span className="text-[10px] text-muted-foreground">{fechaHora(c.creado_en)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm">{c.comentario}</p>
              {c.es_interno ? (
                <span className="mt-1.5 inline-flex items-center rounded-md border border-amber-300/60 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  Nota interna (no visible al reportante)
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p>
      )}

      {puedeComentar ? (
        <form onSubmit={onEnviar} noValidate className="mt-3 flex flex-col gap-2">
          <Label htmlFor="nuevo-comentario" className="sr-only">
            Nuevo comentario
          </Label>
          <Textarea
            id="nuevo-comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="Escribe un comentario…"
            disabled={enviando}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">{comentario.length}/3000</span>
            <Button type="submit" size="sm" disabled={enviando || comentario.trim().length === 0}>
              {enviando ? "Publicando…" : "Comentar"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Historial → Timeline                                                */
/* ------------------------------------------------------------------ */

/** Convierte el historial append-only en hitos de la Timeline. */
function aHitos(historial: HistorialItem[]) {
  return historial.map((h) => {
    const etiqueta = ETIQUETAS_HISTORIAL[h.tipo_cambio] ?? "Actualización";
    const descripcion =
      h.detalle ??
      ([
        h.campo,
        h.valor_anterior ? `de ${h.valor_anterior}` : null,
        h.valor_nuevo ? `a ${h.valor_nuevo}` : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined);

    return {
      title: h.actor ? `${etiqueta} · ${h.actor}` : etiqueta,
      description: descripcion,
      fecha: fechaHora(h.creado_en),
      estado: "done" as const,
    };
  });
}
