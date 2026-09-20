"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * PROVEEDOR REALTIME DE NOTIFICACIONES · SIR-UPSJB (FASE 9)
 *
 * SEGURIDAD: se suscribe a `notificaciones` con postgres_changes SIN filtro
 * de servidor propio — la BD aplica la policy p_notificaciones_select (0007)
 * a CADA suscriptor vía RLS: cada usuario recibe SOLO las filas de su perfil.
 * Un usuario que manipule el cliente no ve notificaciones ajenas: el canal
 * simplemente no le entrega filas que RLS no le concede. Las tablas
 * operativas (incidencias, etc.) NO están publicadas en supabase_realtime.
 *
 * CONEXIÓN: estado conectado/desconectado visible; ante caída, Supabase
 * Realtime reintenta con backoff y el estado se refleja en la UI (la bandeja
 * sigue utilizable con los datos ya cargados). Sin credenciales: usa el
 * navegador autenticado (mismo JWT en cookies que el servidor).
 */

export type EstadoRealtime = "conectando" | "conectado" | "desconectado" | "error";

interface CargoRealtime {
  /** Nº de notificaciones no leídas (badge). */
  noLeidas: number;
  /** Aumenta en +1 por cada INSERT recibido (para refrescar bandejas). */
  version: number;
  estado: EstadoRealtime;
  /** Marca TODO como leído en memoria (optimista; la acción de servidor revalida). */
  ponerTodoLeido: () => void;
}

const Contexto = React.createContext<CargoRealtime | null>(null);

export function useNotificacionesRealtime(): CargoRealtime {
  const valor = React.useContext(Contexto);
  if (!valor) {
    // Fallback seguro fuera del provider: sin realtime pero funcional.
    return { noLeidas: 0, version: 0, estado: "desconectado", ponerTodoLeido: () => undefined };
  }
  return valor;
}

export function ProveedorNotificacionesRealtime({
  noLeidasIniciales,
  habilitado = true,
  usuarioId,
  children,
}: {
  noLeidasIniciales: number;
  /** Solo se suscribe si hay sesión (los layouts ya la resolvieron). */
  habilitado?: boolean;
  /**
   * Identifica el canal (Fase 14): el nombre de canal en Supabase Realtime es
   * global; sin sufijo por usuario, dos sesiones de DISTINTOS usuarios
   * comparten canal y Realtime re-envía events ya filtrados por RLS de otro.
   * La seguridad no cambia (RLS filtra igual), pero el canal propio evita
   * trabajo innecesario en el socket.
   */
  usuarioId?: string;
  children: React.ReactNode;
}) {
  const [noLeidas, setNoLeidas] = React.useState(noLeidasIniciales);
  const [version, setVersion] = React.useState(0);
  const [estado, setEstado] = React.useState<EstadoRealtime>("conectando");
  // Referencia al estado actual para los temporizadores (el closure del
  // useEffect no se re-crea al cambiar `estado`): sin esto, el intervalo de
  // reconexión lee SIEMPRE "conectando" y re-suscribe cada 75 s incluso
  // estando conectado (micro-cortes del badge). Causa raíz corregida.
  const refEstado = React.useRef<EstadoRealtime>("conectando");

  React.useEffect(() => {
    setNoLeidas(noLeidasIniciales);
  }, [noLeidasIniciales]);

  React.useEffect(() => {
    if (!habilitado) {
      setEstado("desconectado");
      return;
    }

    const supabase = createClient();
    let canal: RealtimeChannel | null = null;
    let cancelado = false;
    let reintentos = 0;
    refEstado.current = "conectando";

    const suscribir = (): RealtimeChannel => {
      const c = supabase
        .channel(
          usuarioId
            ? `notificaciones-usuario-${usuarioId}`
            : "notificaciones-usuario"
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notificaciones" },
          () => {
            // INSERT siempre es una notificación NUEVA (no leída) del propio
            // usuario (RLS): +1 al badge y señal para refrescar listas.
            setNoLeidas((v) => v + 1);
            setVersion((v) => v + 1);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notificaciones" },
          (payload) => {
            // UPDATE: si la fila propia pasó a leída, descuenta el badge.
            const nueva = payload.new as { leida_en?: string | null } | null;
            const anterior = payload.old as { leida_en?: string | null } | null;
            if (nueva?.leida_en && !anterior?.leida_en) {
              setNoLeidas((v) => Math.max(0, v - 1));
              setVersion((v) => v + 1);
            }
          }
        )
        .on("presence", { event: "sync" }, () => undefined)
        .subscribe((estadoCanal) => {
          if (cancelado) return;
          if (estadoCanal === "SUBSCRIBED") {
            refEstado.current = "conectado";
            setEstado("conectado");
            reintentos = 0;
          } else if (estadoCanal === "CHANNEL_ERROR") {
            refEstado.current = "error";
            setEstado("error");
          } else if (estadoCanal === "TIMED_OUT") {
            refEstado.current = "desconectado";
            setEstado("desconectado");
          } else if (estadoCanal === "CLOSED") {
            refEstado.current = "desconectado";
            setEstado("desconectado");
          }
        });
      return c;
    };

    canal = suscribir();

    // RECONEXIÓN propia con backoff (complementa la de la librería): si el
    // canal quedó cerrado/erróneo, re-suscribe tras esperar progresivamente.
    // Lee el estado por referencia (siempre fresco), no del closure.
    const temporizador = setInterval(() => {
      if (cancelado) return;
      if (refEstado.current === "conectado") return;
      reintentos += 1;
      if (reintentos % 5 === 0) {
        if (canal) supabase.removeChannel(canal);
        canal = suscribir();
      }
    }, 15_000);

    return () => {
      cancelado = true;
      clearInterval(temporizador);
      if (canal) supabase.removeChannel(canal);
    };
    // El intervalo lee `refEstado` (referencia fresca), así que NO hace falta
    // re-crear el efecto al cambiar `estado` — solo depende de las props.
  }, [habilitado, usuarioId]);

  const ponerTodoLeido = React.useCallback(() => {
    setNoLeidas(0);
    setVersion((v) => v + 1);
  }, []);

  return (
    <Contexto.Provider value={{ noLeidas, version, estado, ponerTodoLeido }}>
      {children}
    </Contexto.Provider>
  );
}
