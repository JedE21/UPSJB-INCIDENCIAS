"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useNotificacionesRealtime } from "@/lib/notificaciones/realtime";

/**
 * RealtimeRefresher — componente invisible que usa el EVENTO realtime
 * (cambio de `version`) para pedir router.refresh() a las rutas de servidor
 * montadas: la bandeja de notificaciones y las listas del panel se
 * actualizan solas cuando llega una notificación nueva o se marca leída.
 *
 * Server Components no pueden suscribirse a realtime: este puente
 * cliente → refresh es el mecanismo compatible con la arquitectura
 * (los datos SIGUIEN viniendo de servidor con RLS; realtime solo avisa).
 */
export function RealtimeRefresher({
  /** Rutas que deben refrescarse cuando cambian las notificaciones. */
  rutas = ["/notificaciones"],
}: {
  rutas?: string[];
}) {
  const { version } = useNotificacionesRealtime();
  const router = useRouter();
  const previa = React.useRef(version);

  React.useEffect(() => {
    if (version !== previa.current) {
      previa.current = version;
      for (const ruta of rutas) router.refresh();
    }
  }, [version, router, rutas]);

  return null;
}
