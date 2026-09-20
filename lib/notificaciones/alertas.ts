import { createClient } from "@/lib/supabase/server";

/**
 * ALERTAS SLA → NOTIFICACIONES (FASE 9): invoca la RPC 0018 desde el
 * servidor (dashboards). La RPC crea la notificación `sla_alerta` para el
 * técnico asignado de cada incidencia vencida/en riesgo (dedupe por
 * evento+incidencia+destinatario no leída). Los permisos los revalida la BD
 * (el técnico solo puede disparar sus propias alertas por la RPC de lectura
 * slas_asignadas_al_tecnico; admin/coordinador pasan por soy_administrador).
 */
export async function notificarAlertasSla(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("notificar_alertas_sla");
  if (error) return 0;
  return Number(data ?? 0);
}
