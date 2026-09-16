/**
 * ROLES ↔ PANELES · SIR-UPSJB
 *
 * La base de datos es la fuente de verdad (public.roles / usuarios_roles) y el
 * JWT lleva los roles vigentes en el claim `roles` (migración 0010 +
 * Custom Access Token Hook). Este módulo solo traduce roles → contexto de UI,
 * oculta botones y calcula la redirección; la decisión FINAL de acceso la
 * toma siempre RLS en PostgreSQL.
 *
 * Regla de permanencia (docs/01 §8.1): un usuario permanece en el panel del
 * rol de MAYOR jerarquía que posea. Ej.: un usuario TECNICO + DOCENTE usa el
 * panel del técnico; un ADMINISTRADOR + TECNICO, el del administrador.
 */

/** Contextos de panel autenticado (coinciden con app/ y lib/navigation.ts). */
export type Panel = "usuario" | "tecnico" | "coordinador" | "admin";

/** Roles reconocidos por el sistema (semilla 0005). */
export type RoleName =
  | "ADMINISTRADOR"
  | "COORDINADOR"
  | "SUPERVISOR"
  | "TECNICO"
  | "DOCENTE"
  | "ADMINISTRATIVO"
  | "ESTUDIANTE";

/**
 * Jerarquía de permanencia: menor índice = mayor jerarquía.
 * Debe coincidir con el orden del array_agg de la migración 0010.
 */
export const ROLE_HIERARCHY: readonly RoleName[] = [
  "ADMINISTRADOR",
  "COORDINADOR",
  "SUPERVISOR",
  "TECNICO",
  "DOCENTE",
  "ADMINISTRATIVO",
  "ESTUDIANTE",
] as const;

/** Panel (AppContext) al que pertenece cada rol. */
export const ROLE_TO_PANEL: Record<RoleName, Panel> = {
  ADMINISTRADOR: "admin",
  COORDINADOR: "coordinador",
  SUPERVISOR: "coordinador",
  TECNICO: "tecnico",
  DOCENTE: "usuario",
  ADMINISTRATIVO: "usuario",
  ESTUDIANTE: "usuario",
};

/** Raíz (home) de cada panel, para redirección post-login. */
export const PANEL_HOME: Record<Panel, string> = {
  usuario: "/mis-incidencias",
  tecnico: "/tecnico/dashboard",
  coordinador: "/coordinador/dashboard",
  admin: "/admin",
};

/** Ruta de perfil DENTRO de cada panel (los layouts exigen el panel correcto). */
export const PANEL_PERFIL: Record<Panel, string> = {
  usuario: "/perfil",
  tecnico: "/tecnico/perfil",
  coordinador: "/coordinador/perfil",
  admin: "/admin/perfil",
};

/** Ruta de perfil correspondiente a estos roles (para el menú de sesión). */
export function perfilDeRoles(roles: readonly string[]): string {
  return PANEL_PERFIL[panelDeRoles(roles)];
}

/**
 * Devuelve el panel del rol de mayor jerarquía entre los roles del usuario.
 * Con roles vacíos/desconocidos cae en "usuario" (el rol base es ESTUDIANTE).
 */
export function panelDeRoles(roles: readonly string[]): Panel {
  for (const role of ROLE_HIERARCHY) {
    if (roles.includes(role)) return ROLE_TO_PANEL[role];
  }
  return "usuario";
}

/** Home del panel correspondiente a estos roles (redirección post-login). */
export function homeDeRoles(roles: readonly string[]): string {
  return PANEL_HOME[panelDeRoles(roles)];
}
