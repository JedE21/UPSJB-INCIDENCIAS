/**
 * CAPA DE DATOS DE NOTIFICACIONES · SIR-UPSJB (FASE 9 — Plan §20)
 *
 * Toda la autorización vive en la BD: las RPC 0018 replican la policy
 * p_notificaciones_select (perfil_id = usuario_actual()) y el UPDATE de
 * lectura está limitado por RLS a la fila propia (p_notificaciones_update).
 * El cliente nunca decide a quién pertenece una notificación.
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Fila de la bandeja (RPC mis_notificaciones, 0018). */
export interface NotificacionItem {
  id: string;
  titulo: string;
  cuerpo: string;
  leida_en: string | null;
  creado_en: string;
  /** Código INC-… de la incidencia enlazada (null si no aplica). */
  codigo_incidencia: string | null;
  /** Estado actual de la incidencia enlazada (para el chip visual). */
  estado_incidencia: string | null;
}

/**
 * OPTIMIZACIÓN (Fase 14): memoizadas por request — el layout (contador) y
 * la página (bandeja) comparten resultado sin segunda consulta.
 */

/** Bandeja del usuario autenticado (más recientes primero). */
export const listarNotificaciones = cache(
  async (opciones?: {
    soloNoLeidas?: boolean;
    limite?: number;
  }): Promise<NotificacionItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mis_notificaciones", {
    p_solo_no_leidas: opciones?.soloNoLeidas ?? false,
    p_limite: opciones?.limite ?? 50,
  });
  if (error) return []; // RPC no aplicada aún: bandeja vacía sin romper
  return ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    id: String(f.id),
    titulo: String(f.titulo ?? ""),
    cuerpo: String(f.cuerpo ?? ""),
    leida_en: typeof f.leida_en === "string" ? f.leida_en : null,
    creado_en: String(f.creado_en ?? ""),
    codigo_incidencia: typeof f.codigo_incidencia === "string" ? f.codigo_incidencia : null,
    estado_incidencia: typeof f.estado_incidencia === "string" ? f.estado_incidencia : null,
  }));
  }
);

/** Contador de no leídas (badge del header; RPC 0018). */
export const contarNoLeidas = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("notificaciones_no_leidas");
  if (error) return 0;
  return Number(data ?? 0);
});

/* ------------------------------------------------------------------ */
/* Preferencias (modelo 0001; dominio ampliado en 0018)                */
/* ------------------------------------------------------------------ */

/** Eventos notificables (CHECK de BD replicado para la UI). */
export const EVENTOS_NOTIFICACION = [
  { evento: "nueva_incidencia", etiqueta: "Mis reportes registrados" },
  { evento: "asignada", etiqueta: "Incidencias asignadas a mí" },
  { evento: "derivada", etiqueta: "Mis incidencias derivadas de área" },
  { evento: "en_proceso", etiqueta: "Cambios a «En proceso»" },
  { evento: "en_espera", etiqueta: "Cambios a «En espera»" },
  { evento: "resuelta", etiqueta: "Incidencias resueltas" },
  { evento: "cerrada", etiqueta: "Incidencias cerradas" },
  { evento: "cancelada", etiqueta: "Incidencias canceladas" },
  { evento: "comentario", etiqueta: "Comentarios en mis incidencias" },
  { evento: "sla_alerta", etiqueta: "Alertas de SLA (si atiendo incidencias)" },
] as const;

export interface PreferenciaNotificacion {
  evento: string;
  habilitado: boolean;
}

/** Preferencias del usuario; sin fila para un evento = habilitado (BD). */
export const listarPreferencias = cache(async (): Promise<PreferenciaNotificacion[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("preferencias_notificacion")
    .select("evento, habilitado")
    .order("evento");
  return (data ?? []) as PreferenciaNotificacion[];
});
