"use client";

import { AlertTriangle, CheckCircle2, Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { fechaHora } from "@/lib/fechas";
import {
  etiquetaEstadoSla,
  horasLegibles,
  minutosLegibles,
  type SlaDetalle,
} from "@/lib/incidencias/sla-formato";

/**
 * PanelSla — seguimiento de tiempos del acuerdo SLA de UNA incidencia
 * (Fase 8b, Plan §19). Solo presentación: los objetivos, los eventos y el
 * estado (cumplido / en riesgo / vencido) los calcula la BD (RPC 0017) con
 * now() de PostgreSQL; el navegador no aporta tiempos.
 *
 * · null              → no se muestra nada (sin acceso).
 * · tiene_sla = false → «Sin SLA configurado» (no hay acuerdo para su
 *                       prioridad; configurable por el administrador).
 *
 * Nota de política: el modelo aprobado no contempla pausas del cronómetro
 * (p. ej. por estado En espera) — el tiempo corre corrido hasta validación
 * institucional; se informa en el panel.
 */
export function PanelSla({
  sla,
  className,
}: {
  sla: SlaDetalle | null;
  className?: string;
}) {
  if (!sla) return null;

  if (!sla.tiene_sla) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
          className
        )}
      >
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className="size-3.5" aria-hidden />
          Sin SLA configurado
        </p>
        <p className="mt-0.5">
          No hay un acuerdo de nivel de servicio activo para la prioridad de esta
          incidencia. El administrador puede configurarlo en Configuración → SLA.
        </p>
      </div>
    );
  }

  const resp = etiquetaEstadoSla(sla.estado_respuesta);
  const resol = etiquetaEstadoSla(sla.estado_resolucion);
  const vencido = sla.estado_resolucion === "vencido";
  const enRiesgo = sla.estado_resolucion === "en_riesgo";
  const cumplido = sla.estado_resolucion === "cumplido";
  const IconoEstado = vencido ? AlertTriangle : cumplido ? CheckCircle2 : Timer;

  const borde = vencido
    ? "border-red-200 dark:border-red-500/30"
    : enRiesgo
      ? "border-amber-200 dark:border-amber-500/30"
      : "border-border";

  const colorBarra = vencido
    ? "bg-red-500"
    : enRiesgo
      ? "bg-amber-500"
      : "bg-primary/70";

  return (
    <div className={cn("rounded-lg border bg-muted/20 px-3 py-3 text-xs", borde, className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <IconoEstado
            className={cn(
              "size-3.5",
              vencido ? "text-red-600" : enRiesgo ? "text-amber-600" : "text-primary"
            )}
            aria-hidden
          />
          SLA · respuesta {horasLegibles(sla.horas_respuesta)} · resolución{" "}
          {horasLegibles(sla.horas_resolucion)}
        </p>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
            resol.clases
          )}
        >
          {resol.texto}
        </span>
      </div>

      <dl className="mt-2 grid gap-1.5 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="sr-only">Inicio del cómputo</dt>
          <dd>Inicio: {sla.inicio_en ? fechaHora(sla.inicio_en) : "—"}</dd>
        </div>
        <div>
          <dt className="sr-only">Objetivo de resolución</dt>
          <dd>Vence: {sla.objetivo_resolucion_en ? fechaHora(sla.objetivo_resolucion_en) : "—"}</dd>
        </div>
        <div>
          <dt className="sr-only">Primera respuesta</dt>
          <dd>
            Respuesta:{" "}
            {sla.primera_respuesta_en
              ? fechaHora(sla.primera_respuesta_en)
              : sla.minutos_restantes_respuesta !== null
                ? `en ${minutosLegibles(sla.minutos_restantes_respuesta)}`
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Resolución</dt>
          <dd>
            Resolución:{" "}
            {sla.resolucion_en
              ? fechaHora(sla.resolucion_en)
              : sla.minutos_restantes_resolucion !== null
                ? `quedan ${minutosLegibles(sla.minutos_restantes_resolucion)}`
                : "—"}
          </dd>
        </div>
      </dl>

      {sla.porcentaje_transcurrido !== null && !cumplido ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={sla.porcentaje_transcurrido}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiempo transcurrido del SLA"
        >
          <div className={cn("h-full rounded-full", colorBarra)} style={{ width: `${sla.porcentaje_transcurrido}%` }} />
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Tiempo corrido desde el reporte. El sistema no pausa el cronómetro en «En
        espera» (política pendiente de validación institucional).
      </p>
    </div>
  );
}
