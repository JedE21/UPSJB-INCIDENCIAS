/**
 * CONSULTAS DEL MÓDULO DE INCIDENCIAS (solo servidor) · SIR-UPSJB
 *
 * Todas las consultas usan el cliente Supabase de SERVIDOR con el JWT del
 * usuario: RLS (0007) decide qué filas son visibles. Nunca service-role.
 *
 * Visibilidad según RLS:
 *   · `incidencias`          → dueño, técnico activo, coordinador de área, admin,
 *                              supervisor (p_incidencias_select).
 *   · `incidencia_historial` → dueño, técnico asignado, admin.
 *   · `incidencia_adjuntos` / `_comentarios` → dueño, técnico asignado, admin.
 *   · `incidencia_asignaciones` → dueño, técnico, admin (p_asignaciones_select).
 *   · Catálogos de incidencias → lectura para autenticados.
 *   · `equipos` / `equipos_ambientes` → técnico/coordinador/admin (un usuario
 *     común NO lista equipos; el equipo relacionado queda "preparado para
 *     integración" y se registra cuando exista la gestión de inventario).
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  EvidenciaItem,
  HistorialItem,
  IncidenciaDetalle,
  IncidenciaResumen,
  OpcionCatalogo,
  OpcionSubtipo,
} from "@/lib/incidencias/tipos";

/* ------------------------------------------------------------------ */
/* Catálogos (fuente de verdad: BD — semilla 0005; sin hardcodeo)      */
/* ------------------------------------------------------------------ */

/**
 * OPTIMIZACIÓN (Fase 14): `cache()` de React memoiza por request. Los
 * catálogos y listados se consultan UNA vez por render aunque el layout y
 * la página (o varios componentes) los pidan en el mismo request.
 */

/** Tipos de incidencia activos, orden alfabético. */
export const listarTiposIncidencia = cache(async (): Promise<OpcionCatalogo[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipos_incidencia")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los tipos de incidencia: ${error.message}`);
  return data ?? [];
});

/** Subtipos activos con su tipo padre (para el select dependiente). */
export const listarSubtiposIncidencia = cache(async (): Promise<OpcionSubtipo[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subtipos_incidencia")
    .select("id, nombre, tipo_incidencia_id")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los subtipos: ${error.message}`);
  return data ?? [];
});

/** Prioridades activas ordenadas por nivel (1=Baja … 4=Crítica). */
export const listarPrioridades = cache(
  async (): Promise<Array<OpcionCatalogo & { nivel: number }>> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prioridades")
      .select("id, nombre, nivel")
      .eq("activo", true)
      .order("nivel", { ascending: true });
    if (error) throw new Error(`No se pudieron cargar las prioridades: ${error.message}`);
    return data ?? [];
  }
);

/** Equipo del ambiente (opcional en el reporte; RPC 0012 — RLS 0007 intacta). */
export interface EquipoDeAmbiente {
  equipo_id: string;
  codigo_interno: string;
  categoria: string | null;
}

/**
 * Equipos ACTIVOS asignados actualmente a un ambiente (equipos_ambientes
 * activa + equipos activo). Usa la RPC SECURITY DEFINER de 0012: un usuario
 * común no lee equipos directamente (p_equipos_lectura). Lista mínima:
 * código interno y categoría; nada de series ni estados de inventario.
 */
export const listarEquiposDeAmbiente = cache(
  async (ambienteId: string): Promise<EquipoDeAmbiente[]> => {
  const supabase = await createClient();
  if (!/^[0-9a-fA-F-]{36}$/.test(ambienteId)) return [];
  const { data, error } = await supabase.rpc("equipos_de_ambiente", {
    p_ambiente_id: ambienteId,
  });
  if (error) return []; // Sin equipos (o RPC aún no aplicada): el campo queda opcional vacío.
  return (data ?? []) as EquipoDeAmbiente[];
  }
);

/* ------------------------------------------------------------------ */
/* Selects compartidos                                                 */
/* ------------------------------------------------------------------ */

/** Select enriquecido de una incidencia + ambiente + jerarquía (solo UI). */
const SELECT_INCIDENCIA = `
  id, codigo, descripcion, fecha_reporte, fecha_asignacion, fecha_inicio,
  fecha_resolucion, fecha_cierre,
  tipos_incidencia ( nombre ),
  subtipos_incidencia ( nombre ),
  prioridades ( nombre ),
  estados_incidencia ( nombre ),
  canales_reporte ( nombre ),
  ambientes (
    nombre, codigo,
    tipos_ambiente ( nombre ),
    pisos ( numero, nombre, pabellones ( nombre, sedes ( nombre ) ) )
  )` as const;

type JerarquiaAnidada = {
  nombre: string;
  codigo: string;
  tipos_ambiente: { nombre: string } | null;
  pisos: {
    numero: number;
    nombre: string | null;
    pabellones: { nombre: string; sedes: { nombre: string } | null } | null;
  } | null;
};

type RowIncidencia = {
  id: string;
  codigo: string;
  descripcion: string;
  fecha_reporte: string;
  fecha_asignacion: string | null;
  fecha_inicio: string | null;
  fecha_resolucion: string | null;
  fecha_cierre: string | null;
  tipos_incidencia: { nombre: string } | null;
  subtipos_incidencia: { nombre: string } | null;
  prioridades: { nombre: string } | null;
  estados_incidencia: { nombre: string } | null;
  canales_reporte: { nombre: string } | null;
  ambientes: JerarquiaAnidada | null;
};

/** Normaliza la fila anidada de PostgREST a IncidenciaResumen (tolerante). */
function aResumen(row: RowIncidencia, extra: Partial<IncidenciaResumen> = {}): IncidenciaResumen {
  const amb = row.ambientes;
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipos_incidencia?.nombre ?? "—",
    subtipo: row.subtipos_incidencia?.nombre ?? null,
    prioridad: row.prioridades?.nombre ?? "—",
    estado: row.estados_incidencia?.nombre ?? "—",
    descripcion: row.descripcion,
    fecha_reporte: row.fecha_reporte,
    ambiente_nombre: amb?.nombre ?? "(ambiente eliminado)",
    ambiente_codigo: amb?.codigo ?? "—",
    tipo_ambiente: amb?.tipos_ambiente?.nombre ?? null,
    piso: amb?.pisos ? (amb.pisos.nombre ?? `Piso ${amb.pisos.numero}`) : null,
    pabellon: amb?.pisos?.pabellones?.nombre ?? null,
    sede: amb?.pisos?.pabellones?.sedes?.nombre ?? null,
    tecnico_asignado: null,
    area_responsable: null,
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Lectura individual                                                  */
/* ------------------------------------------------------------------ */

/**
 * Busca una incidencia por su código único (para seguimiento público
 * autenticado y detalle). La visibilidad la decide RLS: si el lector no
 * puede verla, el resultado es null (indistinguible de "no existe").
 */
export async function obtenerIncidenciaPorCodigo(
  codigo: string
): Promise<IncidenciaDetalle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidencias")
    .select(`${SELECT_INCIDENCIA}, perfiles ( nombres, apellido_paterno, apellido_materno )`)
    .eq("codigo", codigo)
    .maybeSingle<RowIncidencia & { perfiles: { nombres: string; apellido_paterno: string; apellido_materno: string | null } | null }>();

  if (error) throw new Error(`No se pudo buscar la incidencia: ${error.message}`);
  if (!data) return null;

  const base = aResumen(data);
  const p = data.perfiles;
  const detalle: IncidenciaDetalle = {
    ...base,
    fecha_asignacion: data.fecha_asignacion,
    fecha_inicio: data.fecha_inicio,
    fecha_resolucion: data.fecha_resolucion,
    fecha_cierre: data.fecha_cierre,
    reportante: p ? [p.nombres, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ") : null,
    canal: data.canales_reporte?.nombre ?? null,
    equipos: [],
    adjuntos: [],
    comentarios: [],
    historial: [],
  };

  // Detalles complementarios: cada consulta respeta su propia RLS; si el
  // lector no tiene acceso, la tabla simplemente viene vacía.
  const [equipos, adjuntos, comentarios, historial, asignaciones, derivaciones] = await Promise.all([
    listarEquiposDeIncidencia(supabase, data.id),
    listarEvidenciasDeIncidencia(data.id),
    listarComentarios(supabase, data.id),
    listarHistorial(supabase, data.id),
    obtenerAsignacionActiva(supabase, data.id),
    listarDerivacionesDeIncidencia(data.id),
  ]);

  detalle.equipos = equipos;
  detalle.adjuntos = adjuntos;
  detalle.comentarios = comentarios;
  detalle.historial = historial;
  if (asignaciones?.tecnico) detalle.tecnico_asignado = asignaciones.tecnico;
  // Área/servicio responsable = destino VIGENTE (fila activa de
  // incidencia_derivaciones; modelo D7: el estado no se duplica).
  const vigente = derivaciones.find((d) => d.activa);
  if (vigente) {
    detalle.area_responsable = vigente.area_destino;
    detalle.servicio_responsable = vigente.servicio_destino;
  }
  detalle.derivaciones = derivaciones;

  return detalle;
}

/* ------------------------------------------------------------------ */
/* FASE 8 · Derivaciones (área/servicio responsable)                   */
/* ------------------------------------------------------------------ */

/** Derivación registrada de una incidencia (historial de traslados). */
export interface DerivacionItem {
  id: string;
  area_origen: string | null;
  area_destino: string;
  /** UUID del área destino (requerido por DerivacionResumen; cascadas de gestión). */
  area_destino_id: string;
  servicio_destino: string | null;
  motivo: string;
  activa: boolean;
  derivado_por: string | null;
  derivado_en: string;
}

/**
 * Historial completo de derivaciones de la incidencia (incidencia_derivaciones
 * con RLS p_derivaciones_select: dueño, técnico, coordinador del área destino
 * o admin). La fila con `activa` define el área/servicio responsable actual.
 */
export async function listarDerivacionesDeIncidencia(
  incidenciaId: string
): Promise<DerivacionItem[]> {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(incidenciaId)) {
    return [];
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidencia_derivaciones")
    .select(
      `id, motivo, activa, derivado_en,
       fk_incidencia_derivaciones_origen ( nombre ),
       fk_incidencia_derivaciones_destino ( nombre ),
       servicios ( nombre ),
       perfiles ( nombres, apellido_paterno, apellido_materno )`
    )
    .eq("incidencia_id", incidenciaId)
    .order("derivado_en", { ascending: true });

  type Row = {
    id: string;
    motivo: string;
    activa: boolean;
    derivado_en: string;
    fk_incidencia_derivaciones_origen: { nombre: string } | null;
    fk_incidencia_derivaciones_destino: { id: string; nombre: string } | null;
    servicios: { nombre: string } | null;
    perfiles: { nombres: string; apellido_paterno: string; apellido_materno: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    area_origen: r.fk_incidencia_derivaciones_origen?.nombre ?? null,
    area_destino: r.fk_incidencia_derivaciones_destino?.nombre ?? "—",
    area_destino_id: r.fk_incidencia_derivaciones_destino?.id ?? "",
    servicio_destino: r.servicios?.nombre ?? null,
    motivo: r.motivo,
    activa: r.activa,
    derivado_por: r.perfiles
      ? [r.perfiles.nombres, r.perfiles.apellido_paterno, r.perfiles.apellido_materno]
          .filter(Boolean)
          .join(" ")
      : null,
    derivado_en: r.derivado_en,
  }));
}

/** Áreas activas (para el formulario de derivación manual autorizada). */
export async function listarAreasActivas(): Promise<OpcionCatalogo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("areas")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return data ?? [];
}

/** Servicios activos con su área (para derivación con servicio destino). */
export async function listarServiciosPorArea(): Promise<Array<OpcionCatalogo & { area_id: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("servicios")
    .select("id, nombre, area_id")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return data ?? [];
}

/** Técnicos activos por área (para la asignación manual autorizada). */
export async function listarTecnicosPorArea(): Promise<
  Array<{ id: string; nombre: string; area_id: string; sede_id: string | null }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tecnicos")
    .select(
      `id, area_id, sede_id,
       perfiles ( nombres, apellido_paterno, apellido_materno )`
    )
    .eq("activo", true)
    .order("id");

  type Row = {
    id: string;
    area_id: string;
    sede_id: string | null;
    perfiles: { nombres: string; apellido_paterno: string; apellido_materno: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((t) => ({
    id: t.id,
    area_id: t.area_id,
    sede_id: t.sede_id,
    nombre: t.perfiles
      ? [t.perfiles.nombres, t.perfiles.apellido_paterno, t.perfiles.apellido_materno]
          .filter(Boolean)
          .join(" ")
      : "Técnico",
  }));
}

/* ------------------------------------------------------------------ */
/* Detalle complementario (internas del módulo; RLS por tabla)         */
/* ------------------------------------------------------------------ */

async function listarEquiposDeIncidencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  incidenciaId: string
): Promise<IncidenciaDetalle["equipos"]> {
  const { data } = await supabase
    .from("incidencia_equipos")
    .select(
      `equipo_id, es_equipo_principal,
       equipos ( codigo_interno, categorias_equipos ( nombre ) )`
    )
    .eq("incidencia_id", incidenciaId);

  type Row = {
    equipo_id: string;
    es_equipo_principal: boolean;
    equipos: { codigo_interno: string; categorias_equipos: { nombre: string } | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.equipo_id,
    codigo_interno: r.equipos?.codigo_interno ?? "—",
    categoria: r.equipos?.categorias_equipos?.nombre ?? null,
    es_principal: r.es_equipo_principal,
  }));
}

/**
 * Evidencias de una incidencia con signed URLs de corta duración generadas en
 * SERVIDOR por la RPC `url_firma_evidencia` (0013). Los buckets son privados
 * (0009): nunca se construyen URLs públicas ni se expone el path al cliente.
 * Si el lector no tiene acceso a una evidencia, su `url` llega null.
 */
export async function listarEvidenciasDeIncidencia(
  incidenciaId: string
): Promise<EvidenciaItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidencia_adjuntos")
    .select(
      `id, nombre_archivo, mime_type, tamano_bytes, tipo, path, creado_en,
       perfiles ( nombres, apellido_paterno, apellido_materno )`
    )
    .eq("incidencia_id", incidenciaId)
    .order("creado_en", { ascending: true });

  type Row = {
    id: string;
    nombre_archivo: string;
    mime_type: string;
    tamano_bytes: number | null;
    tipo: string;
    path: string;
    creado_en: string;
    perfiles: { nombres: string; apellido_paterno: string; apellido_materno: string | null } | null;
  };
  const filas = (data ?? []) as unknown as Row[];

  // Signed URLs en paralelo; fallo individual → url null (la tarjeta muestra
  // el archivo con sus metadatos aunque la firma falle).
  const urls = await Promise.all(
    filas.map((f) => firmarEvidencia(supabase, f.path))
  );

  const puedeEliminar = await puedeEliminarEvidencias();

  return filas.map((f, i) => ({
    id: f.id,
    nombre_archivo: f.nombre_archivo,
    mime_type: f.mime_type,
    tamano_bytes: f.tamano_bytes,
    tipo: f.tipo,
    creado_en: f.creado_en,
    subido_por: f.perfiles
      ? [f.perfiles.nombres, f.perfiles.apellido_paterno, f.perfiles.apellido_materno]
          .filter(Boolean)
          .join(" ")
      : null,
    url: urls[i],
    puede_eliminar: puedeEliminar,
  }));
}

/** Firma una evidencia vía RPC de servidor (null si no autorizado/no existe). */
async function firmarEvidencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
): Promise<string | null> {
  const { data } = await supabase.rpc("url_firma_evidencia", { p_path: path });
  return typeof data === "string" && data.length > 0 ? data : null;
}

/** ¿El lector actual puede eliminar evidencias? (solo ADMINISTRADOR; 0013). */
async function puedeEliminarEvidencias(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("soy_administrador");
  return data === true;
}

/**
 * @deprecated Usar `listarEvidenciasDeIncidencia` (URLs firmadas + permisos).
 * Se mantiene solo como consulta cruda de filas para usos internos.
 */
async function listarAdjuntos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  incidenciaId: string
): Promise<EvidenciaItem[]> {
  const { data } = await supabase
    .from("incidencia_adjuntos")
    .select("id, nombre_archivo, mime_type, tamano_bytes, tipo, creado_en")
    .eq("incidencia_id", incidenciaId)
    .order("creado_en", { ascending: true });
  return (
    data?.map((f) => ({
      ...f,
      subido_por: null,
      url: null,
      puede_eliminar: false,
    })) ?? []
  );
}

async function listarComentarios(
  supabase: Awaited<ReturnType<typeof createClient>>,
  incidenciaId: string
): Promise<IncidenciaDetalle["comentarios"]> {
  const { data } = await supabase
    .from("incidencia_comentarios")
    .select(
      `id, comentario, es_interno, creado_en,
       perfiles ( nombres, apellido_paterno, apellido_materno )`
    )
    .eq("incidencia_id", incidenciaId)
    .order("creado_en", { ascending: true });

  type Row = {
    id: string;
    comentario: string;
    es_interno: boolean;
    creado_en: string;
    perfiles: { nombres: string; apellido_paterno: string; apellido_materno: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    comentario: r.comentario,
    es_interno: r.es_interno,
    creado_en: r.creado_en,
    autor: r.perfiles
      ? [r.perfiles.nombres, r.perfiles.apellido_paterno, r.perfiles.apellido_materno]
          .filter(Boolean)
          .join(" ")
      : null,
  }));
}

async function listarHistorial(
  supabase: Awaited<ReturnType<typeof createClient>>,
  incidenciaId: string
): Promise<HistorialItem[]> {
  const { data } = await supabase
    .from("incidencia_historial")
    .select(
      `id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle, creado_en,
       perfiles ( nombres, apellido_paterno, apellido_materno )`
    )
    .eq("incidencia_id", incidenciaId)
    .order("creado_en", { ascending: true });

  type Row = {
    id: string;
    tipo_cambio: string;
    campo: string | null;
    valor_anterior: string | null;
    valor_nuevo: string | null;
    detalle: string | null;
    creado_en: string;
    perfiles: { nombres: string; apellido_paterno: string; apellido_materno: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    tipo_cambio: r.tipo_cambio,
    campo: r.campo,
    valor_anterior: r.valor_anterior,
    valor_nuevo: r.valor_nuevo,
    detalle: r.detalle,
    creado_en: r.creado_en,
    actor: r.perfiles
      ? [r.perfiles.nombres, r.perfiles.apellido_paterno, r.perfiles.apellido_materno]
          .filter(Boolean)
          .join(" ")
      : null,
  }));
}

async function obtenerAsignacionActiva(
  supabase: Awaited<ReturnType<typeof createClient>>,
  incidenciaId: string
): Promise<{ tecnico: string | null } | null> {
  const { data } = await supabase
    .from("incidencia_asignaciones")
    .select(
      `tecnicos (
         perfiles ( nombres, apellido_paterno, apellido_materno )
       )`
    )
    .eq("incidencia_id", incidenciaId)
    .eq("activa", true)
    .limit(1)
    .maybeSingle<{
      tecnicos: {
        perfiles: { nombres: string; apellido_paterno: string; apellido_materno: string | null } | null;
      } | null;
    } | null>();

  const perfiles = data?.tecnicos?.perfiles;
  if (!perfiles) return null;
  return {
    tecnico: [perfiles.nombres, perfiles.apellido_paterno, perfiles.apellido_materno]
      .filter(Boolean)
      .join(" "),
  };
}

/* ------------------------------------------------------------------ */
/* MÓDULO TÉCNICO (asignadas al técnico autenticado)                   */
/* ------------------------------------------------------------------ */

/** Incidencia asignada al técnico (vista de lista, con ubicación). */
export interface IncidenciaAsignada extends IncidenciaResumen {
  tecnico_acepto: boolean;
}

/** KPIs del dashboard técnico (contados en servidor con RLS). */
export interface KpisTecnico {
  asignadas: number;
  enProceso: number;
  enEspera: number;
  resueltas: number;
}

/**
 * Incidencias ASIGNADAS al técnico autenticado (asignación activa).
 * El JOIN con tecnnicos filtra por perfil; RLS de incidencias (técnico activo)
 * también autoriza la lectura.Orden: más recientes primero.
 */
export const listarIncidenciasAsignadas = cache(async (): Promise<IncidenciaAsignada[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidencia_asignaciones")
    .select(
      `id, aceptado_en,
       incidencias (${SELECT_INCIDENCIA})`
    )
    .eq("activa", true)
    .order("asignado_en", { ascending: false })
    .limit(100);

  type Row = {
    aceptado_en: string | null;
    incidencias: RowIncidencia | null;
  };
  const filas = ((data ?? []) as unknown as Row[]).filter((r) => r.incidencias);
  if (error) {
    throw new Error(`No se pudieron cargar tus incidencias asignadas: ${error.message}`);
  }
  return filas.map((r) => ({
    ...aResumen(r.incidencias as RowIncidencia),
    tecnico_acepto: Boolean(r.aceptado_en),
  }));
});

/**
 * KPIs del técnico: derivados de la MISMA lista de asignaciones activas.
 * Acepta la lista ya cargada para evitar duplicar la consulta del dashboard
 * (optimización Fase 14: 2 consultas → 1); si no llega, la carga (memo en
 * request por React cache() en el cliente Supabase).
 */
export async function obtenerKpisTecnico(preCargadas?: IncidenciaAsignada[]): Promise<KpisTecnico> {
  const incidencias = preCargadas ?? (await listarIncidenciasAsignadas());
  return {
    asignadas: incidencias.filter((i) => i.estado === "Asignada").length,
    enProceso: incidencias.filter((i) => i.estado === "En proceso").length,
    enEspera: incidencias.filter((i) => i.estado === "En espera").length,
    resueltas: incidencias.filter((i) => i.estado === "Resuelta").length,
  };
}

/** Registro técnico (diagnóstico/acciones/solución) de una incidencia. */
export interface RegistroTecnico {
  diagnostico: string | null;
  acciones: string | null;
  solucion: string | null;
}

/** Lee el registro técnico vía RPC (autorización en BD; 0014). */
export async function obtenerRegistroTecnico(
  incidenciaId: string
): Promise<RegistroTecnico | null> {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(incidenciaId)) {
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("tecnico_registro_de_incidencia", {
    p_incidencia_id: incidenciaId,
  });
  const fila = (data as Array<RegistroTecnico> | null)?.[0];
  return fila ?? null;
}

/** SLA vigente de una incidencia (por prioridad, sin especialización). */
export interface SlaDeIncidencia {
  horas_respuesta: number;
  horas_resolucion: number;
}

/**
 * SLA del acuerdo base para la prioridad de la incidencia (tabla
 * acuerdos_nivel_servicio, semilla 0005). Devuelve null si no hay acuerdo;
 * el cálculo de horas HABILES y vencimientos es de fase posterior (SLA).
 */
export async function obtenerSlaDeIncidencia(
  incidenciaId: string
): Promise<SlaDeIncidencia | null> {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(incidenciaId)) {
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidencias")
    .select(
      `prioridad_id,
       acuerdos_nivel_servicio ( horas_respuesta, horas_resolucion )`
    )
    .eq("id", incidenciaId)
    .maybeSingle<{
      prioridad_id: string;
      acuerdos_nivel_servicio: { horas_respuesta: number; horas_resolucion: number } | null;
    }>();

  const acuerdo = data?.acuerdos_nivel_servicio;
  if (!acuerdo) return null;
  return {
    horas_respuesta: Number(acuerdo.horas_respuesta),
    horas_resolucion: Number(acuerdo.horas_resolucion),
  };
}

/**
 * Id (UUID) de una incidencia visible por código (para acciones de servidor
 * tras crearla). Devuelve null si no existe o si RLS no la muestra.
 */
export async function obtenerIdIncidenciaPorCodigo(codigo: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidencias")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Listados                                                            */
/* ------------------------------------------------------------------ */

/** Incidencias del usuario autenticado (RLS: p_incidencias_select; índice 0002). */
export const listarMisIncidencias = cache(async (): Promise<IncidenciaResumen[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidencias")
    .select(SELECT_INCIDENCIA)
    .order("fecha_reporte", { ascending: false })
    .limit(100);

  if (error) throw new Error(`No se pudieron cargar tus incidencias: ${error.message}`);
  return ((data ?? []) as unknown as RowIncidencia[]).map((r) => aResumen(r));
});

/* ------------------------------------------------------------------ */
