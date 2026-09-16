/**
 * CONSULTAS DEL MÓDULO QR (solo servidor) · SIR-UPSJB
 *
 * Funciones de lectura/escritura sobre codigos_qr, ambientes y lecturas_qr
 * usando el cliente Supabase de SERVIDOR (RLS con el JWT del usuario).
 * Nunca service-role. Las pantallas admin consumen estas funciones.
 */

import { createClient } from "@/lib/supabase/server";

/** Fila enriquecida de un código QR para el listado del panel. */
export interface FilaQR {
  id: string;
  codigo: string;
  url_destino: string;
  version: number;
  activo: boolean;
  generado_en: string;
  deshabilitado_en: string | null;
  ambiente_id: string;
  ambiente_nombre: string;
  ambiente_codigo: string;
  tipo_ambiente: string | null;
  piso: string | null;
  pabellon: string | null;
  sede: string | null;
}

/** Ambiente sin QR activo (candidato para crear un QR). */
export interface AmbienteDisponible {
  id: string;
  nombre: string;
  codigo: string;
  tipo: string | null;
  piso: string | null;
  pabellon: string | null;
  sede: string | null;
}

/** Resolución pública de un QR (pantalla /r/<codigo>). */
export interface UbicacionQR {
  qr_codigo: string;
  qr_activo: boolean;
  ambiente_id: string;
  ambiente_nombre: string;
  ambiente_codigo: string;
  ambiente_activo: boolean;
  tipo_ambiente: string | null;
  piso_nombre: string | null;
  piso_numero: number | null;
  pabellon_nombre: string | null;
  sede_nombre: string | null;
  sede_activa: boolean;
  /** true solo si QR + ambiente + sede están activos. */
  disponible: boolean;
}

/** Select enriquecido de QR + ambiente + jerarquía (solo columnas de UI). */
const SELECT_QR = `
  id, codigo, url_destino, version, activo, generado_en, deshabilitado_en,
  ambientes (
    id, nombre, codigo,
    tipos_ambiente ( nombre ),
    pisos ( numero, nombre,
      pabellones ( nombre, sedes ( nombre ) )
    )
  )` as const;

type AmbienteAnidado = {
  id: string;
  nombre: string;
  codigo: string;
  tipos_ambiente: { nombre: string } | null;
  pisos: {
    numero: number;
    nombre: string | null;
    pabellones: {
      nombre: string;
      sedes: { nombre: string } | null;
    } | null;
  } | null;
};

/** Fila cruda del select enriquecido (antes de normalizar). */
type RowQR = Omit<FilaQR, "ambiente_id" | "ambiente_nombre" | "ambiente_codigo" | "tipo_ambiente" | "piso" | "pabellon" | "sede"> & {
  ambientes: AmbienteAnidado | null;
};

/** Fila cruda del select de ambientes disponibles. */
type RowAmbiente = {
  id: string;
  nombre: string;
  codigo: string;
  tipos_ambiente: { nombre: string } | null;
  pisos: {
    numero: number;
    nombre: string | null;
    pabellones: {
      nombre: string;
      sedes: { nombre: string } | null;
    } | null;
  } | null;
};

/** Normaliza la fila anidada de Supabase a FilaQR (tolerante a null). */
function aFilaQR(row: {
  id: string;
  codigo: string;
  url_destino: string;
  version: number;
  activo: boolean;
  generado_en: string;
  deshabilitado_en: string | null;
  ambientes: AmbienteAnidado | null;
}): FilaQR {
  const amb = row.ambientes;
  return {
    id: row.id,
    codigo: row.codigo,
    url_destino: row.url_destino,
    version: row.version,
    activo: row.activo,
    generado_en: row.generado_en,
    deshabilitado_en: row.deshabilitado_en,
    ambiente_id: amb?.id ?? "",
    ambiente_nombre: amb?.nombre ?? "(ambiente eliminado)",
    ambiente_codigo: amb?.codigo ?? "—",
    tipo_ambiente: amb?.tipos_ambiente?.nombre ?? null,
    piso: amb?.pisos
      ? (amb.pisos.nombre ?? `Piso ${amb.pisos.numero}`)
      : null,
    pabellon: amb?.pisos?.pabellones?.nombre ?? null,
    sede: amb?.pisos?.pabellones?.sedes?.nombre ?? null,
  };
}

/** Lista todos los códigos QR con su ambiente (para el panel admin). */
export async function listarQr(): Promise<FilaQR[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("codigos_qr")
    .select(SELECT_QR)
    .order("activo", { ascending: false })
    .order("generado_en", { ascending: false });

  if (error) throw new Error(`No se pudieron cargar los códigos QR: ${error.message}`);
  // Cast explícito: sin tipos generados de BD, PostgREST infiere relaciones.
  const filas = (data ?? []) as unknown as RowQR[];
  return filas.map(aFilaQR);
}

/** Ambientes ACTIVOS sin QR activo (para el selector de creación). */
export async function listarAmbientesDisponibles(): Promise<AmbienteDisponible[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ambientes")
    .select(
      `id, nombre, codigo,
       tipos_ambiente ( nombre ),
       pisos ( numero, nombre,
         pabellones ( nombre, sedes ( nombre ) )
       )` as const
    )
    .eq("activo", true)
    .order("codigo", { ascending: true });

  if (error) throw new Error(`No se pudieron cargar los ambientes: ${error.message}`);
  const ambientes = (data ?? []) as unknown as RowAmbiente[];

  const { data: activos, error: errorQr } = await supabase
    .from("codigos_qr")
    .select("ambiente_id")
    .eq("activo", true);

  if (errorQr) throw new Error(`No se pudieron cargar los QR activos: ${errorQr.message}`);
  const conQrActivo = new Set((activos ?? []).map((f) => f.ambiente_id));

  return ambientes
    .filter((a) => !conQrActivo.has(a.id))
    .map((a) => ({
      id: a.id,
      nombre: a.nombre,
      codigo: a.codigo,
      tipo: a.tipos_ambiente?.nombre ?? null,
      piso: a.pisos ? (a.pisos.nombre ?? `Piso ${a.pisos.numero}`) : null,
      pabellon: a.pisos?.pabellones?.nombre ?? null,
      sede: a.pisos?.pabellones?.sedes?.nombre ?? null,
    }));
}

/**
 * Resuelve un QR público por su código, con banderas de estado.
 * Usa la RPC SECURITY DEFINER de la migración 0011: la app anónima no lee
 * codigos_qr/ambientes directamente (RLS de 0007 solo cubre authenticated).
 * Devuelve la fila aunque esté deshabilitada (para la pantalla 410) con
 * disponible=false; si el código no existe devuelve null.
 */
export async function resolverQrPublico(codigo: string): Promise<UbicacionQR | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolver_qr_publico", { p_codigo: codigo });
  if (error) throw new Error(`No se pudo resolver el QR: ${error.message}`);
  return (data?.[0] as UbicacionQR | undefined) ?? null;
}

/** Indica si existe el código aunque esté deshabilitado (pantalla 410). */
export async function existeQrDeshabilitado(codigo: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("codigos_qr")
    .select("id", { count: "exact", head: true })
    .eq("codigo", codigo)
    .eq("activo", false);
  if (error) return false;
  return (count ?? 0) > 0;
}
