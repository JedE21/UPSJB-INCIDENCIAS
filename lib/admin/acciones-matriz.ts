"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdminConPermiso } from "@/lib/admin/guardia";
import type { EstadoAccionAdmin } from "@/lib/admin/acciones";

/**
 * MATRIZ ROL ↔ PERMISO · SIR-UPSJB (FASE 7)
 *
 * Alterna un permiso concreto de un rol (roles_permisos, PK compuesta).
 * Es la edición de la matriz que se muestra en /admin/roles; el permiso
 * efectivo de cada usuario es la unión por sus roles (§8.1).
 */

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function alternarPermisoRol(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const guardia = await exigirAdminConPermiso("seguridad");
  if (!guardia.ok) return { error: guardia.error };

  const rolId = String(formData.get("rol_id") ?? "").trim();
  const permisoId = String(formData.get("permiso_id") ?? "").trim();
  const conceder = formData.get("__conceder") === "true";

  if (!RE_UUID.test(rolId) || !RE_UUID.test(permisoId)) {
    return { error: "Rol o permiso no válido." };
  }

  const supabase = await createClient();

  if (conceder) {
    const { error } = await supabase
      .from("roles_permisos")
      .upsert(
        { rol_id: rolId, permiso_id: permisoId },
        { onConflict: "rol_id,permiso_id", ignoreDuplicates: true }
      );
    if (error) return { error: "No se pudo conceder el permiso (validado en la base de datos)." };
  } else {
    const { error } = await supabase
      .from("roles_permisos")
      .delete()
      .eq("rol_id", rolId)
      .eq("permiso_id", permisoId);
    if (error) return { error: "No se pudo revocar el permiso (validado en la base de datos)." };
  }

  revalidatePath("/admin/roles");
  return {
    error: null,
    exito: conceder ? "Permiso concedido al rol." : "Permiso revocado al rol.",
  };
}
