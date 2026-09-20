/**
 * CAPA DE DATOS DEL MÓDULO SLA · SIR-UPSJB (FASE 8b — Plan §19/§47)
 *
 * Toda la lógica de tiempos vive en la BD (RPC 0017): el snapshot se fija al
 * crear la incidencia, los eventos se estampan al cambiar de estado y el
 * estado (cumplido / en riesgo / vencido) se calcula con now() de PostgreSQL.
 * Esta capa solo lee (via RPC con la misma autorización que RLS); los tipos
 * y el formato de presentación viven en `sla-formato.ts` (módulo isleto sin
 * dependencias de servidor, importable por client components).
 *
 * Fechas: la BD devuelve timestamptz (ISO con offset). La presentación en
 * America/Lima la hace lib/fechas — NUNCA se calcula tiempo en el navegador.
 * El reloj del navegador no interviene: el único "ahora" es el de la BD.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  EstadoSlaRespuesta,
  EstadoSlaResolucion,
  SlaDetalle,
} from "@/lib/incidencias/sla-formato";

const RE_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * SLA de una incidencia para la UI. Devuelve null si el lector no tiene
 * acceso, la incidencia no existe o NO tiene acuerdo SLA aplicable: en la
 * pantalla se muestra «Sin SLA configurado» sin filtrar información.
 */
export async function obtenerDetalleSla(
  incidenciaId: string
): Promise<SlaDetalle | null> {
  if (!RE_UUID.test(incidenciaId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sla_de_incidencia", {
    p_incidencia_id: incidenciaId,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return aSlaDetalle(data[0] as FilaSla);
}

type FilaSla = Record<string, unknown>;

/** Normaliza la fila de la RPC (numeric → number, text → union). */
function aSlaDetalle(f: FilaSla): SlaDetalle {
  const numero = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);
  const texto = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  return {
    tiene_sla: f.tiene_sla === true,
    horas_respuesta: numero(f.horas_respuesta),
    horas_resolucion: numero(f.horas_resolucion),
    inicio_en: texto(f.inicio_en),
    objetivo_respuesta_en: texto(f.objetivo_respuesta_en),
    objetivo_resolucion_en: texto(f.objetivo_resolucion_en),
    primera_respuesta_en: texto(f.primera_respuesta_en),
    resolucion_en: texto(f.resolucion_en),
    horas_respuesta_real: numero(f.horas_respuesta_real),
    horas_resolucion_real: numero(f.horas_resolucion_real),
    estado_respuesta: texto(f.estado_respuesta) as EstadoSlaRespuesta | null,
    estado_resolucion: texto(f.estado_resolucion) as EstadoSlaResolucion | null,
    minutos_restantes_respuesta: numero(f.minutos_restantes_respuesta),
    minutos_restantes_resolucion: numero(f.minutos_restantes_resolucion),
    porcentaje_transcurrido: numero(f.porcentaje_transcurrido),
  };
}

/* ------------------------------------------------------------------ */
/* Dashboard técnico                                                   */
/* ------------------------------------------------------------------ */

/** Fila de la RPC slas_asignadas_al_tecnico (0017), ya ordenada por urgencia. */
export interface SlaAsignada {
  incidencia_id: string;
  codigo: string;
  estado_incidencia: string;
  prioridad: string;
  estado_respuesta: EstadoSlaRespuesta | null;
  estado_resolucion: EstadoSlaResolucion | null;
  minutos_restantes_resolucion: number | null;
  objetivo_resolucion_en: string | null;
}

/** SLA de las asignaciones activas del técnico autenticado (orden de urgencia). */
export async function obtenerSlasAsignadas(): Promise<SlaAsignada[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("slas_asignadas_al_tecnico");
  if (error) return []; // RPC no aplicada aún: el módulo degrada sin romper
  return ((data ?? []) as FilaSla[]).map((f) => ({
    incidencia_id: String(f.incidencia_id ?? ""),
    codigo: String(f.codigo ?? ""),
    estado_incidencia: String(f.estado_incidencia ?? "—"),
    prioridad: String(f.prioridad ?? "—"),
    estado_respuesta: (f.estado_respuesta as EstadoSlaRespuesta) ?? null,
    estado_resolucion: (f.estado_resolucion as EstadoSlaResolucion) ?? null,
    minutos_restantes_resolucion: numeroONull(f.minutos_restantes_resolucion),
    objetivo_resolucion_en: typeof f.objetivo_resolucion_en === "string" ? f.objetivo_resolucion_en : null,
  }));
}

function numeroONull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

/* ------------------------------------------------------------------ */
/* Indicadores (dashboard admin — Plan §47)                            */
/* ------------------------------------------------------------------ */

/** Indicadores de tiempo y SLA (RPC indicadores_sla, 0017). */
export interface IndicadoresSla {
  conSla: number;
  sinSla: number;
  promHorasRespuesta: number | null;
  promHorasAtencion: number | null;
  promHorasResolucion: number | null;
  respuestaCumplidas: number;
  respuestaVencidas: number;
  resolucionCumplidas: number;
  resolucionVencidas: number;
  activosEnTiempo: number;
  activosEnRiesgo: number;
  activosVencidos: number;
  activosSinSla: number;
  /** null = sin autorización (no admin/coordinador); la UI no muestra nada. */
  autorizado: boolean;
}

/** Indicadores §47 contados y promediados EN SERVIDOR (RPC 0017). */
export async function obtenerIndicadoresSla(): Promise<IndicadoresSla> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("indicadores_sla");
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { ...INDICADORES_VACIOS, autorizado: false };
  }
  const f = data[0] as FilaSla;
  return {
    conSla: Number(f.con_sla ?? 0),
    sinSla: Number(f.sin_sla ?? 0),
    promHorasRespuesta: numeroONull(f.prom_horas_respuesta),
    promHorasAtencion: numeroONull(f.prom_horas_atencion),
    promHorasResolucion: numeroONull(f.prom_horas_resolucion),
    respuestaCumplidas: Number(f.respuesta_cumplidas ?? 0),
    respuestaVencidas: Number(f.respuesta_vencidas ?? 0),
    resolucionCumplidas: Number(f.resolucion_cumplidas ?? 0),
    resolucionVencidas: Number(f.resolucion_vencidas ?? 0),
    activosEnTiempo: Number(f.activos_en_tiempo ?? 0),
    activosEnRiesgo: Number(f.activos_en_riesgo ?? 0),
    activosVencidos: Number(f.activos_vencidos ?? 0),
    activosSinSla: Number(f.activos_sin_sla ?? 0),
    autorizado: true,
  };
}

const INDICADORES_VACIOS: Omit<IndicadoresSla, "autorizado"> = {
  conSla: 0,
  sinSla: 0,
  promHorasRespuesta: null,
  promHorasAtencion: null,
  promHorasResolucion: null,
  respuestaCumplidas: 0,
  respuestaVencidas: 0,
  resolucionCumplidas: 0,
  resolucionVencidas: 0,
  activosEnTiempo: 0,
  activosEnRiesgo: 0,
  activosVencidos: 0,
  activosSinSla: 0,
};
