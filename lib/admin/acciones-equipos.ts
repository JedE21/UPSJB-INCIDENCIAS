"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdminConPermiso, mensajeDeErrorPg } from "@/lib/admin/guardia";
import type { EstadoAccionAdmin } from "@/lib/admin/acciones";

/**
 * ACCIÓN EQUIPO ↔ AMBIENTE · SIR-UPSJB (FASE 7)
 *
 * Asignar un equipo a un ambiente = insertar en `equipos_ambientes` con
 * activa = true. La consistencia la garantiza la BASE DE DATOS:
 *   · Trigger sincronizar_movimientos_equipo (0003): cierra la asignación
 *     activa previa y registra el movimiento (asignación/traslado).
 *   · Índice parcial único uq_asignacion_equipo_activa (0002): a lo sumo una
 *     ubicación activa por equipo.
 *   · FK restrict: el ambiente y el equipo deben existir.
 *   · RLS p_equipos_amb_admin (0007): solo ADMINISTRADOR escribe.
 *
 * La identidad del actor (asignado_por) sale SIEMPRE de la sesión.
 */

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function asignarEquipoAAmbiente(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const guardia = await exigirAdminConPermiso("equipos");
  if (!guardia.ok) return { error: guardia.error };

  const equipoId = String(formData.get("equipo_id") ?? "").trim();
  const ambienteId = String(formData.get("ambiente_id") ?? "").trim();

  if (!RE_UUID.test(equipoId)) return { error: "Selecciona un equipo válido." };
  if (!RE_UUID.test(ambienteId)) return { error: "Selecciona un ambiente válido." };

  const supabase = await createClient();

  // Validación de integridad ANTES del insert (mensajes claros; la FK de BD
  // vuelve a imponerlo igualmente).
  const [equipoRes, ambienteRes] = await Promise.all([
    supabase.from("equipos").select("id, activo").eq("id", equipoId).maybeSingle(),
    supabase.from("ambientes").select("id, activo").eq("id", ambienteId).maybeSingle(),
  ]);

  if (equipoRes.error || !equipoRes.data) {
    return { error: "El equipo indicado no existe (o no es visible para tu rol)." };
  }
  if (ambienteRes.error || !ambienteRes.data) {
    return { error: "El ambiente indicado no existe (o no es visible para tu rol)." };
  }

  const { error } = await supabase.from("equipos_ambientes").insert({
    equipo_id: equipoId,
    ambiente_id: ambienteId,
    activa: true,
    asignado_por: guardia.usuarioId, // de la sesión, nunca del cliente
  });

  if (error) return { error: mensajeDeErrorPg(error, "Asignaciones") };

  revalidatePath("/admin/equipos");
  revalidatePath("/admin/equipos/asignaciones");
  revalidatePath("/admin/equipos/movimientos");
  revalidatePath("/admin/equipos/equipos");

  return {
    error: null,
    exito: "Equipo asignado al ambiente. El movimiento quedó registrado en el historial.",
  };
}
