/**
 * CAPA DE DATOS DE AUDITORÍA · SIR-UPSJB (FASE 11 — Plan §41/§49)
 *
 * Solo LECTURA vía RPC `consultar_auditoria` (0020): la autorización vive en
 * la BD (admin + permiso ver_auditoria — misma matriz que la policy
 * p_auditoria_select). La app jamás escribe en registros_auditoria
 * directamente: la escritura la hacen los triggers/RPC del sistema
 * (append-only; sin UPDATE/DELETE ni siquiera para admin).
 *
 * MÓDULO DE SERVIDOR: los client components importan constantes/parseo desde
 * `constantes.ts` (isleto), nunca desde aquí.
 */

import { createClient } from "@/lib/supabase/server";
import {
  TAMANO_PAGINA,
  type FiltrosAuditoria,
} from "@/lib/auditoria/constantes";

/** Fila de la bandeja de auditoría (RPC consultar_auditoria, 0020). */
export interface RegistroAuditoria {
  id: string;
  creado_en: string;
  accion: string;
  tabla_afectada: string;
  registro_id: string | null;
  codigo_referencia: string | null;
  valores_previos: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  actor_id: string | null;
  actor_nombre: string | null;
}

function aArgs(f: FiltrosAuditoria) {
  const offset = (f.pagina - 1) * TAMANO_PAGINA;
  const aMedianoche = (d: string, fin: boolean) =>
    fin ? `${d}T23:59:59Z` : `${d}T00:00:00Z`;
  return {
    p_accion: f.accion,
    p_tabla: f.tabla,
    p_registro: null,
    p_actor: null,
    p_desde: f.desde ? aMedianoche(f.desde, false) : null,
    p_hasta: f.hasta ? aMedianoche(f.hasta, true) : null,
    p_busqueda: f.busqueda,
    p_limite: TAMANO_PAGINA,
    p_offset: offset,
  };
}

/**
 * Bandeja de auditoría paginada. `error` distingue "sin permiso" (la RPC
 * lanza) de un fallo transitorio; ambos degradan con mensaje controlado.
 */
export async function obtenerAuditoria(
  filtros: FiltrosAuditoria
): Promise<{ registros: RegistroAuditoria[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consultar_auditoria", aArgs(filtros));
  if (error) {
    const msg = error.message || "";
    if (msg.includes("autorización")) {
      return { registros: [], error: "No tienes autorización para consultar la auditoría." };
    }
    return { registros: [], error: "No se pudo consultar la auditoría. Intenta de nuevo." };
  }
  return {
    registros: ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
      id: String(f.id ?? ""),
      creado_en: String(f.creado_en ?? ""),
      accion: String(f.accion ?? ""),
      tabla_afectada: String(f.tabla_afectada ?? ""),
      registro_id: typeof f.registro_id === "string" ? f.registro_id : null,
      codigo_referencia: typeof f.codigo_referencia === "string" ? f.codigo_referencia : null,
      valores_previos: esJsonb(f.valores_previos),
      valores_nuevos: esJsonb(f.valores_nuevos),
      actor_id: typeof f.actor_id === "string" ? f.actor_id : null,
      actor_nombre:
        typeof f.actor_nombre === "string" && f.actor_nombre ? f.actor_nombre : null,
    })),
    error: null,
  };
}

function esJsonb(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
