"use client";

import Link from "next/link";
import { Bell, BellOff, CloudOff } from "lucide-react";
import { useNotificacionesRealtime, type EstadoRealtime } from "@/lib/notificaciones/realtime";
import { cn } from "@/lib/utils";

const ETIQUETA_ESTADO: Record<EstadoRealtime, string> = {
  conectando: "Conectando a tiempo real…",
  conectado: "Actualizaciones en tiempo real activas",
  desconectado: "Sin tiempo real (mostrando la última carga)",
  error: "Error de conexión en tiempo real (reintentando)",
};

/**
 * Campana de notificaciones del header (FASE 9).
 * El badge usa el contador realtime (INSERT/UPDATE de la fila propia vía RLS).
 * Si el canal cae, se muestra un icono de desconexión — la app sigue
 * funcionando con la última carga de servidor (degradación elegante).
 */
export function CampanaNotificaciones() {
  const { noLeidas, estado } = useNotificacionesRealtime();

  return (
    <span className="relative inline-flex items-center" title={ETIQUETA_ESTADO[estado]}>
      <Link
        href="/notificaciones"
        aria-label={
          noLeidas > 0
            ? `Notificaciones: ${noLeidas} sin leer`
            : "Notificaciones: todo leído"
        }
        className={cn(
          "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          noLeidas > 0 && "text-primary"
        )}
      >
        {estado === "conectado" || estado === "conectando" ? (
          <Bell className="size-4" aria-hidden />
        ) : (
          <BellOff className="size-4" aria-hidden />
        )}
        {noLeidas > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white"
            aria-hidden
          >
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        ) : null}
        <span className="sr-only">{ETIQUETA_ESTADO[estado]}</span>
      </Link>
      {estado === "error" || estado === "desconectado" ? (
        <CloudOff className="absolute -bottom-1 -right-1 size-3 text-muted-foreground" aria-hidden />
      ) : null}
    </span>
  );
}
