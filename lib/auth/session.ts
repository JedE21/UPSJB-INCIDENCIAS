import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth/types";
import { panelDeRoles, type Panel } from "@/lib/auth/roles";

/**
 * SESIÓN EN EL SERVIDOR · SIR-UPSJB
 *
 * Todo se resuelve desde el JWT que @supabase/ssr mantiene en cookies:
 *  · Sesión  → supabase.auth.getUser() (valida el token contra Auth, no
 *    confía solo en el contenido del JWT).
 *  · Roles   → claim `roles` del JWT (inyectado por el Custom Access Token
 *    Hook de la migración 0010; no falsificable desde el cliente).
 *  · Perfil  → tabla public.perfiles vía RLS (solo lee SU fila).
 *
 * El ADMINISTRADOR que gestiona otros perfiles debe ir por caminos con RLS
 * explícita (política p_perfiles_admin), no por estas funciones.
 */

export interface SesionActual {
  /** ID del usuario autenticado (auth.users.id = perfiles.id). */
  usuarioId: string;
  correo: string;
  /** Roles vigentes desde el claim `roles` del JWT (vacío si el hook no está configurado). */
  roles: string[];
  /** Perfil desde public.perfiles (puede ser null si aún no se propagó el trigger). */
  perfil: Perfil | null;
}

/**
 * Sesión completa del usuario autenticado, o null si no hay sesión válida.
 * cache(): una sola resolución por request aunque la llamen varios componentes.
 */
export const getSesion = cache(async (): Promise<SesionActual | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Roles desde el JWT (claim `roles`); fallback a usuarios_roles vía RLS si
  // el Custom Access Token Hook aún no está configurado en el Dashboard.
  let roles: string[] = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata.roles as string[])
    : [];

  if (roles.length === 0) {
    const { data: filasRoles } = await supabase
      .from("usuarios_roles")
      .select("roles(nombre)")
      .eq("perfil_id", user.id);
    roles = (filasRoles ?? [])
      .map((f) => (f as { roles?: { nombre?: string } | null }).roles?.nombre)
      .filter((n): n is string => Boolean(n));
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Perfil>();

  return {
    usuarioId: user.id,
    correo: user.email ?? perfil?.correo ?? "",
    roles,
    perfil: perfil ?? null,
  };
});

/** Sesión garantizada: redirige a /login si no hay sesión válida. */
export const getSesionObligatoria = cache(async (): Promise<SesionActual> => {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  return sesion;
});

/** ¿La sesión actual tiene alguno de estos roles? (para ocultar UI; RLS decide el acceso real). */
export const tieneRol = cache(async (...roles: string[]): Promise<boolean> => {
  const sesion = await getSesion();
  if (!sesion) return false;
  return sesion.roles.some((r) => roles.includes(r));
});

/** ¿La sesión actual tiene el permiso efectivo dado? (unión de permisos por rol, §8.1). */
export const tienePermiso = cache(async (permiso: string): Promise<boolean> => {
  const sesion = await getSesion();
  if (!sesion) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("tiene_permiso", { p_permiso: permiso });
  return data === true;
});

/**
 * Guard de layout: exige sesión + perfil activo + pertenecer al panel.
 * La redirección por rol manda al usuario al home de SU panel de mayor jerarquía.
 */
export const exigirPanel = cache(async (panel: Panel): Promise<SesionActual> => {
  const sesion = await getSesionObligatoria();

  if (sesion.perfil && sesion.perfil.estado !== "activo") {
    redirect("/cuenta-suspendida");
  }

  const panelActual = panelDeRoles(sesion.roles);
  if (panelActual !== panel) {
    redirect("/acceso-restringido?panel=" + panelActual);
  }

  return sesion;
});
