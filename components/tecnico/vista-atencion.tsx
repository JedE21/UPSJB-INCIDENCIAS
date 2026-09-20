"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CirclePause,
  CirclePlay,
  FileText,
  ListChecks,
  Stethoscope,
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
import { Modal } from "@/components/ui/modal";
import { Timeline } from "@/components/shared/timeline";
import { ProgresoEstado } from "@/components/incidencias/progreso-estado";
import { PriorityBadge, StatusBadge } from "@/components/incidencias/badges";
import { EvidenciasPanel } from "@/components/tecnico/evidencias-panel";
import { ComentariosPanel } from "@/components/tecnico/comentarios-panel";
import { useToast } from "@/components/ui/toast";
import {
  aceptarIncidenciaAsignada,
  cambiarEstadoIncidencia,
  registrarDiagnostico,
  registrarAccionTecnico,
  resolverIncidenciaAsignada,
  subirEvidencias,
} from "@/lib/incidencias/actions";
import { fechaHora } from "@/lib/fechas";
import { PanelSla } from "@/components/incidencias/panel-sla";
import type { HistorialItem, IncidenciaDetalle } from "@/lib/incidencias/tipos";
import type { RegistroTecnico } from "@/lib/incidencias/datos";
import type { SlaDetalle } from "@/lib/incidencias/sla-formato";

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

/**
 * VistaAtencionTecnico — atención completa de UNA incidencia asignada.
 * Todos los botones llaman Server Actions que delegan en RPCs de BD (0013/0014):
 * la autorización real (asignación activa, transición, permisos) la decide
 * PostgreSQL; si la BD rechaza, el mensaje se muestra en la UI.
 */
export function VistaAtencionTecnico({
  incidencia,
  registro,
  sla,
  puedeAdjuntar,
}: {
  incidencia: IncidenciaDetalle;
  registro: RegistroTecnico | null;
  sla: SlaDetalle | null;
  puedeAdjuntar: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [ocupado, setOcupado] = React.useState<string | null>(null);

  // Diagnóstico
  const [diagnostico, setDiagnostico] = React.useState(registro?.diagnostico ?? "");
  // Acción
  const [accion, setAccion] = React.useState("");
  // En espera
  const [modalEspera, setModalEspera] = React.useState(false);
  const [motivoEspera, setMotivoEspera] = React.useState("");
  // Resolución
  const [modalResolver, setModalResolver] = React.useState(false);
  const [solucion, setSolucion] = React.useState(registro?.solucion ?? "");
  // Evidencia
  const [archivo, setArchivo] = React.useState<File | null>(null);

  const ejecutar = async (
    clave: string,
    operacion: () => Promise<{ error: string | null }>,
    mensajeExito: string
  ): Promise<boolean> => {
    setOcupado(clave);
    try {
      const res = await operacion();
      if (res.error) {
        toast({ title: "No se pudo completar", description: res.error, variant: "destructive" });
      } else {
        toast({ title: mensajeExito, variant: "success" });
        router.refresh();
        return true;
      }
    } catch {
      toast({
        title: "Error de conexión",
        description: "Verifica tu red e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setOcupado(null);
    }
    return false;
  };

  const estado = incidencia.estado;
  const esAsignada = estado === "Asignada";
  const enProceso = estado === "En proceso";
  const enEspera = estado === "En espera";
  const flujoActivo = esAsignada || enProceso || enEspera;

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
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
        <CardContent className="flex flex-col gap-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Dato etiqueta="Ambiente" valor={incidencia.ambiente_nombre} />
            <Dato etiqueta="Fecha de reporte" valor={fechaHora(incidencia.fecha_reporte)} />
            <Dato
              etiqueta="Ubicación"
              valor={
                [incidencia.sede, incidencia.pabellon, incidencia.piso, incidencia.tipo_ambiente]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
            />
            <Dato etiqueta="Reportado por" valor={incidencia.reportante ?? "—"} />
            <Dato
              etiqueta="Área responsable"
              valor={
                incidencia.area_responsable
                  ? `${incidencia.area_responsable}${incidencia.servicio_responsable ? ` · ${incidencia.servicio_responsable}` : ""}`
                  : "—"
              }
            />
            <Dato etiqueta="Técnico asignado" valor={incidencia.tecnico_asignado ?? "—"} />
            <Dato
              etiqueta="Equipo relacionado"
              valor={
                incidencia.equipos.length > 0
                  ? incidencia.equipos
                      .map((e) => `${e.codigo_interno}${e.categoria ? ` (${e.categoria})` : ""}`)
                      .join(", ")
                  : "—"
              }
            />
            <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Descripción</dt>
              <dd className="mt-0.5 whitespace-pre-line">{incidencia.descripcion}</dd>
            </div>
          </dl>

          {/* SLA (Fase 8b): objetivos, eventos y estado los calcula la BD */}
          <PanelSla sla={sla} />

          {/* Acciones de flujo */}
          <div className="flex flex-wrap items-center gap-2">
            {esAsignada ? (
              <Button
                onClick={() =>
                  ejecutar("aceptar", () => aceptarIncidenciaAsignada(incidencia.id), "Incidencia aceptada")
                }
                disabled={ocupado !== null}
              >
                <CirclePlay aria-hidden />
                Aceptar e iniciar atención
              </Button>
            ) : null}
            {enProceso ? (
              <Button
                variant="outline"
                onClick={() => setModalEspera(true)}
                disabled={ocupado !== null}
              >
                <CirclePause aria-hidden />
                Poner en espera
              </Button>
            ) : null}
            {enEspera ? (
              <Button
                onClick={() =>
                  ejecutar(
                    "reanudar",
                    () => cambiarEstadoIncidencia(incidencia.id, "En proceso"),
                    "Atención reanudada"
                  )
                }
                disabled={ocupado !== null}
              >
                <CirclePlay aria-hidden />
                Reanudar atención
              </Button>
            ) : null}
            {enProceso ? (
              <Button onClick={() => setModalResolver(true)} disabled={ocupado !== null}>
                <CircleCheck aria-hidden />
                Resolver
              </Button>
            ) : null}
            {!flujoActivo ? (
              <p className="text-sm text-muted-foreground">
                {estado === "Resuelta"
                  ? "Resuelta: pendiente de confirmación de cierre por el reportante."
                  : "La incidencia ya no está en el flujo activo de atención."}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Diagnóstico y acciones (solo con flujo activo; la BD lo revalida) */}
      {flujoActivo ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="size-4 text-primary" aria-hidden />
                Diagnóstico técnico
              </CardTitle>
              <CardDescription>
                Causa identificada del problema (visible para coordinación y el reportante).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Label htmlFor="diagnostico" className="sr-only">
                Diagnóstico
              </Label>
              <Textarea
                id="diagnostico"
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Ej.: Fuente de poder sin salida de 12 V; la placa recibe energía pero no arranca."
                disabled={ocupado !== null}
              />
              <Button
                size="sm"
                className="self-start"
                disabled={ocupado !== null || diagnostico.trim().length === 0}
                onClick={() =>
                  ejecutar(
                    "diagnostico",
                    () => registrarDiagnostico(incidencia.id, diagnostico),
                    "Diagnóstico registrado"
                  )
                }
              >
                Guardar diagnóstico
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-4 text-primary" aria-hidden />
                Acciones realizadas
              </CardTitle>
              <CardDescription>Registro cronológico de lo realizado en la atención.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {registro?.acciones ? (
                <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  {registro.acciones}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Sin acciones registradas todavía.</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={accion}
                  onChange={(e) => setAccion(e.target.value)}
                  maxLength={500}
                  placeholder="Ej.: Reemplazo de fuente de poder por repuesto del almacén"
                  disabled={ocupado !== null}
                  aria-label="Nueva acción realizada"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={ocupado !== null || accion.trim().length === 0}
                  onClick={async () => {
                    const ok = await ejecutar(
                      "accion",
                      () => registrarAccionTecnico(incidencia.id, accion),
                      "Acción registrada"
                    );
                    if (ok) setAccion("");
                  }}
                >
                  <FileText aria-hidden />
                  Registrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Evidencias (subida + galería; policies de Storage 0009 + RPC 0013) */}
      <EvidenciasPanel
        incidenciaId={incidencia.id}
        evidencias={incidencia.adjuntos}
        puedeAdjuntar={puedeAdjuntar && flujoActivo}
        ocupado={ocupado !== null}
        onSubir={async (archivo) => {
          if (!archivo) return false;
          const ok = await ejecutar(
            "evidencia",
            () => subirEvidencias(incidencia.id, [{ archivo, tipo: "durante" }]),
            "Evidencia adjuntada"
          );
          return ok;
        }}
      />

      {/* Comentarios (RPC 0013) */}
      <ComentariosPanel
        incidenciaId={incidencia.id}
        comentarios={incidencia.comentarios}
        puedeComentar
        ocupado={ocupado !== null}
      />

      {/* Solución aplicada (si ya fue registrada) */}
      {registro?.solucion ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solución aplicada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">{registro.solucion}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Historial + progreso */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ProgresoEstado estado={incidencia.estado} />
          {incidencia.historial.length > 0 ? (
            <Timeline hitos={aHitos(incidencia.historial)} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
          )}
        </CardContent>
      </Card>

      {/* Modal: poner en espera */}
      <Modal
        open={modalEspera}
        onClose={() => (ocupado ? undefined : setModalEspera(false))}
        title="Poner en espera"
        description="La atención queda pausada. El motivo queda registrado en el historial y es visible para el reportante y la coordinación."
        size="sm"
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModalEspera(false)} disabled={ocupado !== null}>
              Cancelar
            </Button>
            <Button
              disabled={ocupado !== null || motivoEspera.trim().length === 0}
              onClick={async () => {
                const ok = await ejecutar(
                  "espera",
                  () => cambiarEstadoIncidencia(incidencia.id, "En espera", motivoEspera),
                  "Incidencia en espera"
                );
                if (ok) {
                  setModalEspera(false);
                  setMotivoEspera("");
                }
              }}
            >
              Poner en espera
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo-espera">Motivo de la espera</Label>
          <Textarea
            id="motivo-espera"
            value={motivoEspera}
            onChange={(e) => setMotivoEspera(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Ej.: Se solicitó repuesto; llega en 48 h."
            disabled={ocupado !== null}
          />
        </div>
      </Modal>

      {/* Modal: resolver */}
      <Modal
        open={modalResolver}
        onClose={() => (ocupado ? undefined : setModalResolver(false))}
        title="Resolver incidencia"
        description="Describe la solución aplicada. El reportante podrá confirmar el cierre después."
        size="sm"
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModalResolver(false)} disabled={ocupado !== null}>
              Cancelar
            </Button>
            <Button
              disabled={ocupado !== null || solucion.trim().length === 0}
              onClick={async () => {
                const ok = await ejecutar(
                  "resolver",
                  () => resolverIncidenciaAsignada(incidencia.id, solucion),
                  "Incidencia resuelta"
                );
                if (ok) setModalResolver(false);
              }}
            >
              Marcar como resuelta
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="solucion-resolucion">Solución aplicada</Label>
          <Textarea
            id="solucion-resolucion"
            value={solucion}
            onChange={(e) => setSolucion(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Ej.: Se reemplazó la fuente de poder y se verificó el arranque con el usuario."
            disabled={ocupado !== null}
          />
          <p className="text-xs text-muted-foreground">{solucion.length}/2000</p>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 font-medium">{valor}</dd>
    </div>
  );
}

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
