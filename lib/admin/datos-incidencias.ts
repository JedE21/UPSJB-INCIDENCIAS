"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin, mensajeDeErrorPg, type GuardiaAdmin } from "@/lib/admin/guardia";
import type {
  EstadoAdminIncidencia,
  IncidenciaAdminFila,
  ResultadoLista,
} from "@/lib/admin/tipos-incidencias";

/**
 * CRUD DE INCIDENCIAS · PANEL ADMIN (FASE 7 — Migración 0022)
 *
 * Leer/crear/editar/eliminar incidencias a nivel de SISTEMA, exclusivo del
 * ADMINISTRADOR:
 *   · READ: RPC incidencias_admin_lista (SECURITY INVOKER; RLS admin).
 *   · CREATE / UPDATE / DELETE: RPC SECURITY DEFINER con guard
 *     soy_administrador() en BD; además la app verifica el rol antes
 *     (guardia). Sin service-role: el JWT del admin autoriza y las
 *     policies p_incidencias_*_admin de 0022 respaldan en PostgreSQL.
 *
 * La "eliminación" es física (con snapshot en registros_auditoria y limpieza
 * de storage en la propia RPC): es la única operación destructiva del panel
 * y exige confirmación explícita en la UI.
 */

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* ------------------------------------------------------------------ */
/* READ                                                                */
/* ------------------------------------------------------------------ */

/**
 * Lista TODAS las incidencias visibles por RLS admin con filtros opcionales.
 * Devuelve error de carga legible si la BD falla (mensajeDeLectura).
 */
export async function listarIncidenciasAdmin(
  filtros: {
    estado?: string;
    pendientes?: boolean;
    sinArea?: boolean;
    sinTecnico?: boolean;
    limite?: number;
    desde?: number;
  } = {}
): Promise<ResultadoLista> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incidencias_admin_lista", {
    p_estado: filtros.estado || null,
    p_pendientes: filtros.pendientes ?? false,
    p_sin_area: filtros.sinArea ?? false,
    p_sin_tecnico: filtros.sinTecnico ?? false,
    p_limite: filtros.limite ?? 300,
    p_offset: filtros.desde ?? 0,
  });

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("row-level security") || msg.includes("permission")) {
      return { filas: [], error: "Tu rol no tiene acceso a estas incidencias (validado en la base de datos)." };
    }
    return { filas: [], error: `No se pudieron cargar las incidencias: ${error.message}` };
  }

  const filas = ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    id: String(f.id ?? ""),
    codigo: String(f.codigo ?? ""),
    descripcion: String(f.descripcion ?? ""),
    fecha_reporte: String(f.fecha_reporte ?? ""),
    estado: String(f.estado ?? "—"),
    prioridad: String(f.prioridad ?? "—"),
    tipo: String(f.tipo ?? "—"),
    subtipo: String(f.subtipo ?? ""),
    ambiente: String(f.ambiente ?? ""),
    ambiente_codigo: String(f.ambiente_codigo ?? ""),
    sede: String(f.sede ?? ""),
    pabellon: String(f.pabellon ?? ""),
    piso: String(f.piso ?? ""),
    reportante: String(f.reportante ?? ""),
    area_responsable: String(f.area_responsable ?? ""),
    tecnico_asignado: String(f.tecnico_asignado ?? ""),
  }));

  return { filas, error: null };
}

/* ------------------------------------------------------------------ */
/* CREATE                                                              */
/* ------------------------------------------------------------------ */

/** Crea una incidencia a nombre del admin (RPC 0022; triggers asignan código). */
export async function crearIncidenciaAdmin(
  _prev: EstadoAdminIncidencia | null,
  formData: FormData
): Promise<EstadoAdminIncidencia> {
  const guardia: GuardiaAdmin = await exigirAdmin();
  if (!guardia.ok) return { error: guardia.error };

  const ambienteId = String(formData.get("ambiente_id") ?? "").trim();
  const tipoId = String(formData.get("tipo_incidencia_id") ?? "").trim();
  const subtipoId = String(formData.get("subtipo_incidencia_id") ?? "").trim();
  const prioridadId = String(formData.get("prioridad_id") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  if (!RE_UUID.test(ambienteId)) return { error: "Selecciona el ambiente." };
  if (!RE_UUID.test(tipoId)) return { error: "Selecciona el tipo de incidencia." };
  if (subtipoId && !RE_UUID.test(subtipoId)) {
    return { error: "El subtipo seleccionado no es válido." };
  }
  if (prioridadId && !RE_UUID.test(prioridadId)) {
    return { error: "La prioridad seleccionada no es válida." };
  }
  if (descripcion.length < 10 || descripcion.length > 2000) {
    return { error: "La descripción debe tener entre 10 y 2000 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incidencias_admin_crear", {
    p_ambiente_id: ambienteId,
    p_tipo_id: tipoId,
    p_subtipo_id: subtipoId || null,
    p_prioridad_id: prioridadId || null,
    p_descripcion: descripcion,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("El ambiente")) return { error: msg };
    if (msg.includes("tipo")) return { error: msg };
    if (msg.includes("subtipo")) return { error: msg };
    if (msg.includes("descripción")) return { error: msg };
    return { error: mensajeDeErrorPg(error, "Incidencias") };
  }

  for (const ruta of ["/admin/incidencias", "/admin", "/admin/reportes", "/admin/mis-incidencias"]) {
    revalidatePath(ruta);
  }

  const fila = Array.isArray(data) ? (data[0] as { codigo?: string } | undefined) : null;
  return { error: null, codigo: fila?.codigo ?? null };
}

/* ------------------------------------------------------------------ */
/* UPDATE                                                              */
/* ------------------------------------------------------------------ */

/**
 * Edita descripción, tipo, subtipo, prioridad y ambiente. El estado NO se
 * toca aquí (transiciones del flujo técnico/derivación). La RPC 0022 deja
 * historial + auditoría en BD.
 */
export async function actualizarIncidenciaAdmin(
  _prev: EstadoAdminIncidencia | null,
  formData: FormData
): Promise<EstadoAdminIncidencia> {
  const guardia = await exigirAdmin();
  if (!guardia.ok) return { error: guardia.error };

  const id = String(formData.get("_id") ?? "").trim();
  if (!RE_UUID.test(id)) return { error: "Incidencia no válida." };

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const tipoId = String(formData.get("tipo_incidencia_id") ?? "").trim();
  const subtipoId = String(formData.get("subtipo_incidencia_id") ?? "").trim();
  const quitarSubtipo = formData.get("_quitar_subtipo") === "1";
  const prioridadId = String(formData.get("prioridad_id") ?? "").trim();
  const ambienteId = String(formData.get("ambiente_id") ?? "").trim();

  if (descripcion && (descripcion.length < 10 || descripcion.length > 2000)) {
    return { error: "La descripción debe tener entre 10 y 2000 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("incidencias_admin_actualizar", {
    p_id: id,
    p_descripcion: descripcion || null,
    p_tipo_id: RE_UUID.test(tipoId) ? tipoId : null,
    p_subtipo_id: RE_UUID.test(subtipoId) && !quitarSubtipo ? subtipoId : null,
    p_quitar_subtipo: quitarSubtipo,
    p_prioridad_id: RE_UUID.test(prioridadId) ? prioridadId : null,
    p_ambiente_id: RE_UUID.test(ambienteId) ? ambienteId : null,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("corresponde al tipo")) return { error: msg };
    if (msg.includes("descripción")) return { error: msg };
    return { error: mensajeDeErrorPg(error, "Incidencias") };
  }

  for (const ruta of ["/admin/incidencias", "/admin/reportes"]) {
    revalidatePath(ruta);
  }
  return { error: null };
}

/* ------------------------------------------------------------------ */
/* DELETE (físico, con snapshot en auditoría)                          */
/* ------------------------------------------------------------------ */

/**
 * Elimina DEFINITIVAMENTE una incidencia (RPC 0022): snapshot en auditoría,
 * limpieza de evidencias del bucket privado y DELETE con cascadas. Requiere
 * confirmación explícita en la UI; la acción ya no se puede deshacer.
 */
export async function eliminarIncidenciaAdmin(
  _prev: EstadoAdminIncidencia | null,
  formData: FormData
): Promise<EstadoAdminIncidencia> {
  const guardia = await exigirAdmin();
  if (!guardia.ok) return { error: guardia.error };

  const id = String(formData.get("_id") ?? "").trim();
  if (!RE_UUID.test(id)) return { error: "Incidencia no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("incidencias_admin_eliminar", { p_id: id });

  if (error) {
    return { error: mensajeDeErrorPg(error, "Incidencias") };
  }

  for (const ruta of ["/admin/incidencias", "/admin", "/admin/reportes", "/admin/auditoria"]) {
    revalidatePath(ruta);
  }
  return { error: null };
}

/* ------------------------------------------------------------------ */
/* Catálogos para los modales de crear/editar                          */
/* ------------------------------------------------------------------ */

/** Opciones para los selects del formulario (ambientes, tipos, subtipos, prioridades). */
export async function cargarCatalogosIncidenciasAdmin(): Promise<{
  ambientes: Array<{ id: string; nombre: string; activo: boolean }>;
  tipos: Array<{ id: string; nombre: string; activo: boolean }>;
  subtipos: Array<{ id: string; nombre: string; tipo_incidencia_id: string; activo: boolean }>;
  prioridades: Array<{ id: string; nombre: string; nivel: number; activo: boolean }>;
  error: string | null;
}> {
  const supabase = await createClient();
  const [amb, tip, sub, pri] = await Promise.all([
    supabase.from("ambientes").select("id, nombre, activo").order("codigo"),
    supabase.from("tipos_incidencia").select("id, nombre, activo").order("nombre"),
    supabase.from("subtipos_incidencia").select("id, nombre, tipo_incidencia_id, activo").order("nombre"),
    supabase.from("prioridades").select("id, nombre, nivel, activo").order("nivel"),
  ]);

  const error = amb.error ?? tip.error ?? sub.error ?? pri.error;
  return {
    ambientes: (amb.data ?? []) as Array<{ id: string; nombre: string; activo: boolean }>,
    tipos: (tip.data ?? []) as Array<{ id: string; nombre: string; activo: boolean }>,
    subtipos: (sub.data ?? []) as Array<{
      id: string;
      nombre: string;
      tipo_incidencia_id: string;
      activo: boolean;
    }>,
    prioridades: (pri.data ?? []) as Array<{ id: string; nombre: string; nivel: number; activo: boolean }>,
    error: error ? error.message : null,
  };
}
