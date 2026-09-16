"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth/session";
import { tieneRol } from "@/lib/auth/session";

/**
 * SERVER ACTIONS DEL MÓDULO QR (solo ADMINISTRADOR) · SIR-UPSJB
 *
 * Corren en el servidor con el cliente Supabase autenticado: RLS (0007)
 * aplica; solo el rol ADMINISTRADOR pasa p_qr_admin. Doble verificación por
 * rol en la acción (defensa en profundidad). Las contrapartes visuales se
 * deshabilitan igualmente en la UI.
 */

export interface EstadoAccionQr {
  error: string | null;
  exito?: string | null;
}

/** Verifica sesión + rol ADMINISTRADOR (además de RLS). */
async function exigirAdmin(): Promise<{ ok: true; usuarioId: string } | { ok: false; error: string }> {
  const sesion = await getSesion();
  if (!sesion) return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
  const esAdmin = await tieneRol("ADMINISTRADOR");
  if (!esAdmin) return { ok: false, error: "Solo el administrador gestiona los códigos QR." };
  return { ok: true, usuarioId: sesion.usuarioId };
}

function mensajePostgres(error: { message: string } | null): string {
  if (!error) return "";
  if (error.message.includes("uq_codigos_qr_ambiente_activo")) {
    return "Ese ambiente ya tiene un código QR activo. Deshabilita el actual o regenera.";
  }
  if (error.message.includes("ck_codigos_qr_formato")) {
    return "El código generado no cumple el formato institucional (ICA-…-0001).";
  }
  return "Operación no completada. Verifica tus permisos e intenta nuevamente.";
}

/**
 * CREA un QR para un ambiente (form con server action; sin API JSON).
 * El código y la URL /r/<codigo> los generan los triggers de BD (0003/0004);
 * aquí solo se inserta { ambiente_id, generado_por }.
 */
export async function crearQr(_prev: EstadoAccionQr | null, formData: FormData): Promise<EstadoAccionQr> {
  const guard = await exigirAdmin();
  if (!guard.ok) return { error: guard.error };

  const ambienteId = String(formData.get("ambiente_id") ?? "").trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(ambienteId)) {
    return { error: "Selecciona un ambiente válido de la lista." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("codigos_qr").insert({
    ambiente_id: ambienteId,
    generado_por: guard.usuarioId,
    // codigo y url_destino los completa el trigger generar_codigo_qr_nuevo.
  });

  if (error) return { error: mensajePostgres(error) };

  revalidatePath("/admin/qr");
  return { error: null, exito: "Código QR creado y asociado al ambiente." };
}

/** DESHABILITA un QR activo (conserva la fila; el QR impreso deja de funcionar). */
export async function deshabilitarQr(
  _prev: EstadoAccionQr | null,
  formData: FormData
): Promise<EstadoAccionQr> {
  const guard = await exigirAdmin();
  if (!guard.ok) return { error: guard.error };

  const qrId = String(formData.get("qr_id") ?? "").trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(qrId)) {
    return { error: "Código QR no válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("codigos_qr")
    .update({ activo: false, deshabilitado_en: new Date().toISOString() })
    .eq("id", qrId)
    .eq("activo", true); // condición extra: nunca re-deshabilitar una fila ya inactiva

  if (error) return { error: mensajePostgres(error) };

  revalidatePath("/admin/qr");
  return { error: null, exito: "Código QR deshabilitado. El QR impreso deja de funcionar." };
}

/**
 * REGENERA el QR de un ambiente: inserta un QR nuevo (version + 1 se calcula
 * con el máximo del ambiente) y el trigger deshabilitar_qr_anterior (0004)
 * desactiva el anterior automáticamente (Regla 9).
 */
export async function regenerarQr(
  _prev: EstadoAccionQr | null,
  formData: FormData
): Promise<EstadoAccionQr> {
  const guard = await exigirAdmin();
  if (!guard.ok) return { error: guard.error };

  const ambienteId = String(formData.get("ambiente_id") ?? "").trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(ambienteId)) {
    return { error: "Ambiente no válido." };
  }

  const supabase = await createClient();

  // Version = máx(versión) del ambiente + 1 (comprobado con RLS de admin).
  const { data: filas, error: errorVersion } = await supabase
    .from("codigos_qr")
    .select("version")
    .eq("ambiente_id", ambienteId)
    .order("version", { ascending: false })
    .limit(1);
  if (errorVersion) return { error: mensajePostgres(errorVersion) };

  const siguienteVersion = (filas?.[0]?.version ?? 0) + 1;

  const { error } = await supabase.from("codigos_qr").insert({
    ambiente_id: ambienteId,
    version: siguienteVersion,
    generado_por: guard.usuarioId,
  });

  if (error) return { error: mensajePostgres(error) };

  revalidatePath("/admin/qr");
  return {
    error: null,
    exito:
      "QR regenerado: se creó un código nuevo (versión " +
      siguienteVersion +
      ") y el anterior quedó deshabilitado. Reimprime y coloca el QR nuevo.",
  };
}
