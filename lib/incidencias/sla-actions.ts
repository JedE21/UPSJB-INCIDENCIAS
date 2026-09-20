"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion, tienePermiso, tieneRol } from "@/lib/auth/session";

/**
 * SERVER ACTIONS DEL MÓDULO SLA · SIR-UPSJB (FASE 8b)
 *
 * Las RPC 0017 revalidan la autorización en BD; estas acciones solo validan
 * entrada y traducen errores. El snapshot del acuerdo se fija tras crear la
 * incidencia (luego de la clasificación, para que la prioridad por defecto
 * de la regla ya esté aplicada) y los eventos se estampan al cambiar de
 * estado. Nada se calcula con el reloj del navegador.
 */

export interface EstadoAccionSla {
  error: string | null;
  /** true si la operación se ejecutó (o no era necesaria). */
  ok: boolean;
}

/** Crea el snapshot de SLA de una incidencia si le corresponde acuerdo (RPC 0017). */
export async function registrarSlaIncidencia(
  incidenciaId: string
): Promise<EstadoAccionSla> {
  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      incidenciaId
    )
  ) {
    return { error: "Incidencia no válida.", ok: false };
  }
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_sla_incidencia", {
    p_incidencia_id: incidenciaId,
  });
  if (error) return { error: error.message, ok: false };
  return { error: null, ok: true };
}

/** Estampa primera respuesta/resolución en el snapshot de SLA (RPC 0017). */
export async function refrescarSlaIncidencia(
  incidenciaId: string
): Promise<EstadoAccionSla> {
  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      incidenciaId
    )
  ) {
    return { error: "Incidencia no válida.", ok: false };
  }
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("refrescar_sla_incidencia", {
    p_incidencia_id: incidenciaId,
  });
  if (error) return { error: error.message, ok: false };
  return { error: null, ok: true };
}

/**
 * BACKFILL (acción de administración, botón en /admin/configuracion): registra
 * el snapshot de las incidencias creadas antes de activar el módulo. La RPC
 * exige admin o coordinador con gestionar_reglas.
 */
export async function registrarSlasPendientes(): Promise<{
  error: string | null;
  registrados: number;
}> {
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión.", registrados: 0 };

  const esAdmin = await tieneRol("ADMINISTRADOR");
  if (!esAdmin) {
    const puedeGestionar = await tienePermiso("gestionar_reglas");
    if (!puedeGestionar) {
      return {
        error: "Solo un administrador puede ejecutar el registro de SLA.",
        registrados: 0,
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_slas_pendientes");
  if (error) {
    return { error: "No se pudo completar el registro de SLA.", registrados: 0 };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin");
  return { error: null, registrados: Number(data ?? 0) };
}
