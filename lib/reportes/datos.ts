/**
 * CAPA DE DATOS DEL MÓDULO DE REPORTES · SIR-UPSJB (FASE 10 — Plan §47/§48)
 *
 * Toda la AGREGACIÓN vive en Postgres (RPC 0019): la app no trae filas
 * crudas para contarlas. La autorización también vive en la BD (admin /
 * coordinador / permiso `ver_reportes`): si el usuario no la tiene, la RPC
 * lanza excepción y aquí se degrada a error controlado por tarjeta.
 *
 * La vista v_reportes_incidencias es SECURITY_INVOKER: el reporte_detalle
 * hereda el RLS del lector (nunca expone filas que RLS niega).
 *
 * Fechas: los filtros llegan como date (YYYY-MM-DD) y se comparan contra
 * fecha_reporte::date en BD; las horas se muestran en America/Lima con
 * lib/fechas. Nada de cálculos en el navegador.
 */

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/* Filtros: parseo + validación (URL → RPC)                            */
/* ------------------------------------------------------------------ */

export interface FiltrosReporte {
  desde: string | null;   // YYYY-MM-DD
  hasta: string | null;   // YYYY-MM-DD
  sedeId: string | null;  // uuid
  areaId: string | null;  // uuid
  estado: string | null;
  prioridad: string | null;
  tipo: string | null;
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida la fecha SEMÁNTICAMENTE (no solo formato): rechaza 2026-13-01 o
 * 2026-02-30, que el regex acepta y Postgres rechazaría con un error 500
 * al pasárselo a la RPC. Causa raíz del fallo detectado en pruebas.
 */
function esFechaValida(t: string): boolean {
  if (!RE_FECHA.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}
const RE_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function texto(v: unknown, max = 60): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

function fecha(v: unknown): string | null {
  const t = texto(v, 10);
  return t && esFechaValida(t) ? t : null;
}

function uuid(v: unknown): string | null {
  const t = texto(v, 36);
  return t && RE_UUID.test(t) ? t : null;
}

/** Lee y valida los filtros de un searchParams de Next (nada entra sin validar). */
export function parsearFiltros(
  sp: Record<string, string | string[] | undefined>
): FiltrosReporte {
  const uno = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    desde: fecha(uno("desde")),
    hasta: fecha(uno("hasta")),
    sedeId: uuid(uno("sede")),
    areaId: uuid(uno("area")),
    estado: texto(uno("estado"), 30),
    prioridad: texto(uno("prioridad"), 20),
    tipo: texto(uno("tipo"), 60),
  };
}

function aArgs(f: FiltrosReporte) {
  return {
    p_desde: f.desde,
    p_hasta: f.hasta,
    p_sede_id: f.sedeId,
    p_area_id: f.areaId,
    p_estado: f.estado,
    p_prioridad: f.prioridad,
    p_tipo: f.tipo,
  };
}

/* ------------------------------------------------------------------ */
/* Indicadores                                                         */
/* ------------------------------------------------------------------ */

export interface IndicadoresAnaliticos {
  total: number;
  pendientes: number;
  enProceso: number;
  resueltas: number;
  cerradas: number;
  criticas: number;
  altas: number;
  medias: number;
  bajas: number;
  derivadas: number;
  sinSla: number;
  fueraSlaResp: number;
  fueraSlaResol: number;
  promHorasRespuesta: number | null;
  promHorasAtencion: number | null;
  promHorasResolucion: number | null;
}

/** KPIs operativos y de tiempo (RPC indicadores_analiticos, 0019). */
export async function obtenerIndicadoresAnaliticos(
  filtros: FiltrosReporte
): Promise<{ datos: IndicadoresAnaliticos | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("indicadores_analiticos", aArgs(filtros));
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { datos: null, error: mensaje(error) };
  }
  const f = data[0] as Record<string, unknown>;
  return {
    datos: {
      total: numero(f.total) ?? 0,
      pendientes: numero(f.pendientes) ?? 0,
      enProceso: numero(f.en_proceso) ?? 0,
      resueltas: numero(f.resueltas) ?? 0,
      cerradas: numero(f.cerradas) ?? 0,
      criticas: numero(f.criticas) ?? 0,
      altas: numero(f.altas) ?? 0,
      medias: numero(f.medias) ?? 0,
      bajas: numero(f.bajas) ?? 0,
      derivadas: numero(f.derivadas) ?? 0,
      sinSla: numero(f.sin_sla) ?? 0,
      fueraSlaResp: numero(f.fuera_sla_resp) ?? 0,
      fueraSlaResol: numero(f.fuera_sla_resol) ?? 0,
      promHorasRespuesta: numero(f.prom_horas_respuesta),
      promHorasAtencion: numero(f.prom_horas_atencion),
      promHorasResolucion: numero(f.prom_horas_resolucion),
    },
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/* Series para gráficos                                                */
/* ------------------------------------------------------------------ */

export interface PuntoSerie {
  etiqueta: string;
  cantidad: number;
  extra: number | null; // promedio de horas (solo servicio_atencion)
}

export type ClaveSerie =
  | "estado"
  | "prioridad"
  | "tipo"
  | "area"
  | "ambiente"
  | "sede"
  | "pabellon"
  | "piso"
  | "equipo"
  | "categoria"
  | "mes"
  | "servicio_atencion";

export const ES_SERIE_VALIDA: readonly ClaveSerie[] = [
  "estado", "prioridad", "tipo", "area", "ambiente", "sede",
  "pabellon", "piso", "equipo", "categoria", "mes", "servicio_atencion",
] as const;

/** Serie agregada en BD (RPC series_analiticas, 0019). Vacía si falla. */
export async function obtenerSerie(
  serie: ClaveSerie,
  filtros: FiltrosReporte,
  limite = 12
): Promise<PuntoSerie[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("series_analiticas", {
    ...aArgs(filtros),
    p_serie: serie,
    p_limite: limite,
  });
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    etiqueta: String(f.etiqueta ?? "—"),
    cantidad: numero(f.cantidad) ?? 0,
    extra: numero(f.extra),
  }));
}

/* ------------------------------------------------------------------ */
/* Detalle (tabla + exportación CSV)                                   */
/* ------------------------------------------------------------------ */

export interface FilaReporte {
  id: string;
  codigo: string;
  estado: string;
  prioridad: string;
  tipo: string;
  ambiente: string;
  sede: string;
  area: string;
  servicio: string;
  fecha_reporte: string;
  fecha_resolucion: string | null;
  horas_resolucion: number | null;
  tiene_sla: boolean;
  cumplio_resolucion: boolean;
  fuera_sla: boolean;
}

/**
 * Filas del reporte (RPC reporte_detalle, 0019 — SECURITY INVOKER: RLS del
 * lector). `puedoVerTodo` solo decide el aviso de UI; la autorización real
 * la aplica la BD.
 */
export async function obtenerDetalleReporte(
  filtros: FiltrosReporte,
  limite = 200
): Promise<{ filas: FilaReporte[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_detalle", {
    ...aArgs(filtros),
    p_limite: limite,
    p_offset: 0,
  });
  if (error) return { filas: [], error: mensaje(error) };
  return {
    filas: ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
      id: String(f.id ?? ""),
      codigo: String(f.codigo ?? ""),
      estado: String(f.estado ?? "—"),
      prioridad: String(f.prioridad ?? "—"),
      tipo: String(f.tipo ?? "—"),
      ambiente: String(f.ambiente ?? "—"),
      sede: String(f.sede ?? "—"),
      area: String(f.area ?? "—"),
      servicio: String(f.servicio ?? "—"),
      fecha_reporte: String(f.fecha_reporte ?? ""),
      fecha_resolucion: typeof f.fecha_resolucion === "string" ? f.fecha_resolucion : null,
      horas_resolucion: numero(f.horas_resolucion),
      tiene_sla: f.tiene_sla === true,
      cumplio_resolucion: f.cumplio_resolucion === true,
      fuera_sla: f.fuera_sla === true,
    })),
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/* Opciones de filtros                                                 */
/* ------------------------------------------------------------------ */

export interface OpcionesFiltro {
  sedes: Array<{ id: string; nombre: string }>;
  areas: Array<{ id: string; nombre: string }>;
  estados: string[];
  prioridades: string[];
  tipos: string[];
}

/** Catálogos activos para los <select> (RPC reporte_filtros, 0019). */
export async function obtenerOpcionesFiltro(): Promise<OpcionesFiltro> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("reporte_filtros");
  const f = ((data ?? []) as Array<Record<string, unknown>>)[0] ?? {};
  return {
    sedes: Array.isArray(f.sedes)
      ? (f.sedes as Array<{ id: string; nombre: string }>)
      : [],
    areas: Array.isArray(f.areas)
      ? (f.areas as Array<{ id: string; nombre: string }>)
      : [],
    estados: Array.isArray(f.estados)
      ? (f.estados as Array<{ nombre: string }>).map((e) => e.nombre)
      : [],
    prioridades: Array.isArray(f.prioridades)
      ? (f.prioridades as Array<{ nombre: string }>).map((p) => p.nombre)
      : [],
    tipos: Array.isArray(f.tipos)
      ? (f.tipos as Array<{ nombre: string }>).map((t) => t.nombre)
      : [],
  };
}

/* ------------------------------------------------------------------ */

function numero(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

/** Mensaje controlado (sin filtrar detalles internos al usuario). */
function mensaje(error: unknown): string {
  const texto = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
  if (texto.includes("autorización")) {
    return "No tienes autorización para consultar reportes.";
  }
  return "No se pudo calcular el reporte. Intenta de nuevo.";
}
