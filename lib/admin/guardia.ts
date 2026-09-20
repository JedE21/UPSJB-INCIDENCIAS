import { getSesion, tieneRol } from "@/lib/auth/session";

/**
 * GUARDIA ADMIN · SIR-UPSJB (FASE 7)
 *
 * MÓDULO DE SERVIDOR (sin "use server"): lo consumen las Server Actions y
 * las páginas. Solo debe importarse desde contexto servidor.
 *
 * Toda acción administrativa pasa por aquí ANTES de tocar la BD:
 *   1. Sesión válida (getUser contra Auth, no solo el contenido del JWT).
 *   2. Rol ADMINISTRADOR (claim `roles` del JWT; no falsificable desde el cliente).
 *   3. Permiso efectivo del rol (tabla roles_permisos; RPC tiene_permiso).
 *
 * Es defensa en profundidad: aunque alguien invocara la Server Action
 * manipulando el cliente, RLS (p_*_admin de la migración 0007) vuelve a
 * imponer la misma regla en PostgreSQL.
 */

/** Permiso efectivo requerido por cada grupo de entidades. */
export const PERMISO_POR_GRUPO: Record<string, string> = {
  infraestructura: "gestionar_infraestructura",
  organizacion: "gestionar_organizacion",
  equipos: "gestionar_equipos",
  usuarios: "gestionar_usuarios",
  seguridad: "gestionar_usuarios",
  qr: "gestionar_qr",
};

export interface GuardiaAdmin {
  ok: boolean;
  error: string;
  usuarioId: string;
}

export function guardiaOk(usuarioId: string): GuardiaAdmin {
  return { ok: true, error: "", usuarioId };
}

export function guardiaError(error: string): GuardiaAdmin {
  return { ok: false, error, usuarioId: "" };
}

/**
 * Exige sesión + ADMINISTRADOR + permiso del grupo. El permiso se verifica
 * con la RPC tiene_permiso (unión de permisos de todos los roles, §8.1).
 */
export async function exigirAdminConPermiso(grupo: string): Promise<GuardiaAdmin> {
  const sesion = await getSesion();
  if (!sesion) return guardiaError("Sesión expirada. Vuelve a iniciar sesión.");

  const esAdmin = await tieneRol("ADMINISTRADOR");
  if (!esAdmin) return guardiaError("Solo el administrador gestiona estas entidades.");

  const permiso = PERMISO_POR_GRUPO[grupo];
  if (permiso) {
    // Verificación en BD (no confía solo en el claim): RLS volverá a aplicarla.
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.rpc("tiene_permiso", { p_permiso: permiso });
    if (data !== true) {
      return guardiaError("Tu rol no tiene el permiso necesario para esta operación.");
    }
  }

  return guardiaOk(sesion.usuarioId);
}

/** Exige sesión + ADMINISTRADOR (sin permiso específico; p. ej. dashboard). */
export async function exigirAdmin(): Promise<GuardiaAdmin> {
  const sesion = await getSesion();
  if (!sesion) return guardiaError("Sesión expirada. Vuelve a iniciar sesión.");
  const esAdmin = await tieneRol("ADMINISTRADOR");
  if (!esAdmin) return guardiaError("Solo el administrador accede a esta operación.");
  return guardiaOk(sesion.usuarioId);
}

/* ------------------------------------------------------------------ */
/* Mapeo de errores de PostgreSQL → mensajes útiles en español         */
/* ------------------------------------------------------------------ */

interface ErrorPostgres {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Traduce los errores más frecuentes de las restricciones declaradas en 0001
 * a mensajes accionables. Lo desconocido cae a un mensaje genérico seguro
 * (sin exponer internals de la BD).
 */
export function mensajeDeErrorPg(error: ErrorPostgres | null, entidad: string): string {
  if (!error) return "Operación no completada.";
  const msg = error.message ?? "";
  const lower = msg.toLowerCase();

  // Violaciones de unicidad (23505) por nombre de constraint.
  const unicos: Array<[string, string]> = [
    ["uq_sedes_nombre", "Ya existe una sede con ese nombre."],
    ["uq_sedes_codigo", "Ya existe una sede con ese código."],
    ["uq_pabellones_sede_codigo", "Ya existe un pabellón con ese código en la sede."],
    ["uq_pisos_pabellon_numero", "Ese pabellón ya tiene un piso con ese número."],
    ["uq_ambientes_codigo", "Ya existe un ambiente con ese código."],
    ["uq_areas_nombre", "Ya existe un área con ese nombre."],
    ["uq_servicios_area_nombre", "Esa área ya tiene un servicio con ese nombre."],
    ["uq_especialidades_tecnicas_nombre", "Ya existe una especialidad con ese nombre."],
    ["uq_roles_nombre", "Ya existe un rol con ese nombre."],
    ["uq_permisos_codigo", "Ya existe un permiso con ese código."],
    ["uq_categorias_equipos_nombre", "Ya existe una categoría con ese nombre."],
    ["uq_marcas_equipos_nombre", "Ya existe una marca con ese nombre."],
    ["uq_estados_equipos_nombre", "Ya existe un estado de equipo con ese nombre."],
    ["uq_modelos_equipos_marca_nombre", "Esa marca ya tiene un modelo con ese nombre."],
    ["uq_equipos_codigo_interno", "Ya existe un equipo con ese código interno."],
    ["uq_equipos_numero_serie", "Ya existe un equipo con ese número de serie."],
    ["uq_tecnicos_perfil", "Ese usuario ya está registrado como técnico."],
    ["uq_tecnicos_codigo", "Ya existe un técnico con ese código."],
  ];
  for (const [constraint, mensaje] of unicos) {
    if (lower.includes(constraint)) return mensaje;
  }

  if (error.code === "23505" || lower.includes("duplicate key")) {
    return `Ya existe un registro duplicado en ${entidad}.`;
  }
  if (error.code === "23503" || lower.includes("foreign key")) {
    // FK restrict: la fila está referenciada por datos operativos.
    if (lower.includes("delete") || lower.includes("update")) {
      return `No se puede modificar: hay registros que dependen de este dato de ${entidad}. Desactívalo en lugar de eliminarlo.`;
    }
    return "La referencia indicada no existe o fue desactivada.";
  }
  if (error.code === "23514" || lower.includes("check")) {
    return `Algún valor no cumple las reglas de ${entidad}. Revisa los campos indicados.`;
  }
  if (error.code === "42501" || lower.includes("row-level security") || lower.includes("permission")) {
    return "No tienes permisos para esta operación (validado en la base de datos).";
  }
  if (lower.includes("jwt") || lower.includes("session")) {
    return "Sesión expirada. Vuelve a iniciar sesión.";
  }
  return "Operación no completada. Verifica los datos e intenta nuevamente.";
}

/** Formatea un error de acceso a datos para pantalla (listados). */
export function mensajeDeLectura(error: { message?: string } | null): string {
  const lower = (error?.message ?? "").toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission")) {
    return "Tu rol no tiene acceso a estos datos (validado en la base de datos).";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "No se pudo conectar con el servicio. Revisa tu conexión e intenta nuevamente.";
  }
  return `No se pudieron cargar los datos: ${error?.message ?? "error desconocido"}`;
}
