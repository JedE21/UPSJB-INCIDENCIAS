/**
 * TIPOS Y FORMATO DEL MÓDULO SLA · SIR-UPSJB (FASE 8b)
 *
 * Módulo ISLETO (sin dependencias de servidor): lo importan tanto la capa de
 * datos (lib/incidencias/sla.ts) como los client components
 * (components/incidencias/panel-sla.tsx). Mismo patrón que evidencias.ts.
 *
 * Aquí vive SOLO presentación: los cálculos de tiempo los hace la BD
 * (RPC 0017) con now() de PostgreSQL — el navegador nunca calcula tiempos.
 */

/** Estado del SLA de respuesta (RPC estado_sla_respuesta). */
export type EstadoSlaRespuesta = "pendiente" | "cumplido" | "vencido" | "sin_dato";

/** Estado del SLA de resolución (RPC estado_sla_resolucion). */
export type EstadoSlaResolucion =
  | "en_tiempo"
  | "en_riesgo"
  | "cumplido"
  | "vencido"
  | "sin_dato";

/** Fila devuelta por la RPC sla_de_incidencia (0017). */
export interface SlaDetalle {
  tiene_sla: boolean;
  horas_respuesta: number | null;
  horas_resolucion: number | null;
  inicio_en: string | null;
  objetivo_respuesta_en: string | null;
  objetivo_resolucion_en: string | null;
  primera_respuesta_en: string | null;
  resolucion_en: string | null;
  horas_respuesta_real: number | null;
  horas_resolucion_real: number | null;
  estado_respuesta: EstadoSlaRespuesta | null;
  estado_resolucion: EstadoSlaResolucion | null;
  minutos_restantes_respuesta: number | null;
  minutos_restantes_resolucion: number | null;
  porcentaje_transcurrido: number | null;
}

/** "18 h" (entero) o "1.5 h" (decimales reales) — horas corridas. */
export function horasLegibles(horas: number | null | undefined): string {
  if (horas === null || horas === undefined) return "—";
  return `${Number.isInteger(horas) ? horas : horas.toFixed(1)} h`;
}

/** "2 d 3 h", "5 h 20 min", "45 min" o "venció hace X" según el signo. */
export function minutosLegibles(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "—";
  const futuro = minutos >= 0;
  const m = Math.abs(Math.round(minutos));
  const dias = Math.floor(m / 1440);
  const horas = Math.floor((m % 1440) / 60);
  const restantes = m % 60;
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias} d`);
  if (horas > 0) partes.push(`${horas} h`);
  if (dias === 0 && restantes > 0) partes.push(`${restantes} min`);
  const texto = partes.length > 0 ? partes.join(" ") : "menos de 1 min";
  return futuro ? texto : `venció hace ${texto}`;
}

/** Etiqueta y matiz visual del estado del SLA (§50: icono + texto en la UI). */
export function etiquetaEstadoSla(
  estado: EstadoSlaRespuesta | EstadoSlaResolucion | null
): { texto: string; clases: string } {
  switch (estado) {
    case "cumplido":
      return {
        texto: "Cumplido",
        clases:
          "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
      };
    case "en_tiempo":
      return {
        texto: "En tiempo",
        clases:
          "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
      };
    case "en_riesgo":
      return {
        texto: "En riesgo",
        clases:
          "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
      };
    case "vencido":
      return {
        texto: "Vencido",
        clases:
          "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
      };
    case "pendiente":
      return {
        texto: "Pendiente",
        clases:
          "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30",
      };
    default:
      return {
        texto: "Sin dato",
        clases: "bg-muted text-muted-foreground border-border",
      };
  }
}
