"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdminConPermiso } from "@/lib/admin/guardia";
import type { EstadoAccionAdmin } from "@/lib/admin/acciones";

/**
 * ACCIONES DEL MÓDULO USUARIOS · SIR-UPSJB (FASE 7)
 *
 * El ADMINISTRADOR (con permiso gestionar_usuarios):
 *   · Asigna y retira ROLES (usuarios_roles) — la fuente de verdad.
 *   · Suspende/reactiva cuentas (perfiles.estado).
 *
 * Credenciales: NUNCA se tocan aquí (solo Supabase Auth).
 * Tras cambiar roles se llama a sincronizar_roles_auth (RPC 0010) para
 * refrescar el claim del JWT; la sesión afectada lo verá en su próximo
 * refresh de token (proxy.ts).
 */

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* ------------------------------------------------------------------ */
/* ROLES DE UN USUARIO                                                 */
/* ------------------------------------------------------------------ */

/** Asigna un rol a un usuario (idempotente). */
export async function asignarRol(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const guardia = await exigirAdminConPermiso("usuarios");
  if (!guardia.ok) return { error: guardia.error };

  const perfilId = String(formData.get("perfil_id") ?? "").trim();
  const rolId = String(formData.get("rol_id") ?? "").trim();

  if (!RE_UUID.test(perfilId)) return { error: "Usuario no válido." };
  if (!RE_UUID.test(rolId)) return { error: "Selecciona un rol válido." };

  const supabase = await createClient();

  // 1) Verificar que el rol existe y está activo (RLS p_roles_lectura).
  const { data: rol, error: errorRol } = await supabase
    .from("roles")
    .select("id, nombre, activo")
    .eq("id", rolId)
    .maybeSingle<{ id: string; nombre: string; activo: boolean }>();
  if (errorRol || !rol) return { error: "El rol seleccionado no existe." };
  if (!rol.activo) return { error: "Ese rol está desactivado y no puede asignarse." };

  // 2) Insert idempotente (PK compuesta perfil_id + rol_id).
  const { error: errorInsert } = await supabase
    .from("usuarios_roles")
    .upsert(
      { perfil_id: perfilId, rol_id: rolId, asignado_por: guardia.usuarioId },
      { onConflict: "perfil_id,rol_id", ignoreDuplicates: true }
    );
  if (errorInsert) {
    return { error: "No se pudo asignar el rol (validado en la base de datos)." };
  }

  // 3) Sincronizar el claim del JWT para que RLS lo vea de inmediato.
  await supabase.rpc("sincronizar_roles_auth", { p_usuario: perfilId });

  revalidatePath("/admin/usuarios");
  return { error: null, exito: `Rol ${rol.nombre} asignado al usuario.` };
}

/** Retira un rol de un usuario. */
export async function retirarRol(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const guardia = await exigirAdminConPermiso("usuarios");
  if (!guardia.ok) return { error: guardia.error };

  const perfilId = String(formData.get("perfil_id") ?? "").trim();
  const rolId = String(formData.get("rol_id") ?? "").trim();

  if (!RE_UUID.test(perfilId)) return { error: "Usuario no válido." };
  if (!RE_UUID.test(rolId)) return { error: "Rol no válido." };

  const supabase = await createClient();

  // Blindaje: el admin no puede quitarse el propio rol ADMINISTRADOR
  // (evita perder el control del sistema accidentalmente).
  const { data: propia } = await supabase
    .from("usuarios_roles")
    .select("rol_id, roles ( nombre )")
    .eq("perfil_id", guardia.usuarioId)
    .eq("rol_id", rolId)
    .maybeSingle<{ rol_id: string; roles: { nombre: string } | null }>();
  if (propia && propia.roles?.nombre === "ADMINISTRADOR" && perfilId === guardia.usuarioId) {
    return { error: "No puedes retirarte tu propio rol de ADMINISTRADOR." };
  }

  const { error } = await supabase
    .from("usuarios_roles")
    .delete()
    .eq("perfil_id", perfilId)
    .eq("rol_id", rolId);
  if (error) {
    return { error: "No se pudo retirar el rol (validado en la base de datos)." };
  }

  await supabase.rpc("sincronizar_roles_auth", { p_usuario: perfilId });

  revalidatePath("/admin/usuarios");
  return { error: null, exito: "Rol retirado del usuario." };
}

/* ------------------------------------------------------------------ */
/* ESTADO DE LA CUENTA                                                 */
/* ------------------------------------------------------------------ */

/** Suspende o reactiva una cuenta (perfiles.estado). */
export async function cambiarEstadoCuenta(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const guardia = await exigirAdminConPermiso("usuarios");
  if (!guardia.ok) return { error: guardia.error };

  const perfilId = String(formData.get("perfil_id") ?? "").trim();
  const nuevoEstado = formData.get("__nuevo_estado") === "suspendido" ? "suspendido" : "activo";

  if (!RE_UUID.test(perfilId)) return { error: "Usuario no válido." };
  if (perfilId === guardia.usuarioId) {
    return { error: "No puedes cambiar el estado de tu propia cuenta." };
  }

  const supabase = await createClient();

  // RLS p_perfiles_admin autoriza; la columna estado tiene CHECK en BD.
  const { error } = await supabase
    .from("perfiles")
    .update({ estado: nuevoEstado })
    .eq("id", perfilId)
    .eq("estado", nuevoEstado === "activo" ? "suspendido" : "activo"); // transición real

  if (error) {
    return { error: "No se pudo cambiar el estado de la cuenta (validado en la base de datos)." };
  }

  revalidatePath("/admin/usuarios");
  return {
    error: null,
    exito:
      nuevoEstado === "suspendido"
        ? "Cuenta suspendida: el usuario no podrá iniciar sesión ni operar."
        : "Cuenta reactivada.",
  };
}
