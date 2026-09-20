"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth/session";
import { EVENTOS_NOTIFICACION } from "@/lib/notificaciones/datos";

/**
 * SERVER ACTIONS DE NOTIFICACIONES · SIR-UPSJB (FASE 9)
 *
 * La autorización la impone RLS en BD:
 *  · UPDATE de lectura: p_notificaciones_update solo permite tocar la fila
 *    propia (perfil_id = usuario_actual()); el trigger de la app nunca envía
 *    perfil_id del cliente.
 *  · Preferencias: p_preferencias_all exige fila propia (o admin).
 */

export interface EstadoNotificacion {
  error: string | null;
}

const RE_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Marca UNA notificación como leída (del usuario autenticado; RLS). */
export async function marcarNotificacionLeida(
  notificacionId: string
): Promise<EstadoNotificacion> {
  if (!RE_UUID.test(notificacionId)) {
    return { error: "Notificación no válida." };
  }
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() })
    .eq("id", notificacionId)
    .eq("perfil_id", sesion.usuarioId) // defensa en profundidad + RLS
    .is("leida_en", null);

  if (error) {
    return { error: "No se pudo marcar la notificación como leída." };
  }
  revalidatePath("/notificaciones");
  return { error: null };
}

/** Marca TODAS las no leídas del usuario como leídas (RLS: solo las propias). */
export async function marcarTodasLeidas(): Promise<EstadoNotificacion> {
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() })
    .eq("perfil_id", sesion.usuarioId)
    .is("leida_en", null);

  if (error) {
    return { error: "No se pudieron marcar las notificaciones como leídas." };
  }
  revalidatePath("/notificaciones");
  return { error: null };
}

/**
 * Alterna una preferencia del usuario (opt-out por evento). La fila se
 * crea/actualiza con perfil_id de la SESIÓN, nunca del cliente.
 */
export async function alternarPreferencia(
  evento: string,
  habilitado: boolean
): Promise<EstadoNotificacion> {
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const eventoValido = EVENTOS_NOTIFICACION.some((e) => e.evento === evento);
  if (!eventoValido) {
    return { error: "Evento de notificación no válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("preferencias_notificacion").upsert(
    { perfil_id: sesion.usuarioId, evento, habilitado },
    { onConflict: "perfil_id,evento" }
  );

  if (error) {
    return { error: "No se pudo guardar tu preferencia." };
  }
  revalidatePath("/notificaciones");
  return { error: null };
}
