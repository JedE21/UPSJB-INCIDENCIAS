"use client";

import { useEffect } from "react";

/**
 * Registro de lectura del QR (tabla lecturas_qr, §14.2).
 * Fire-and-forget: POST a /api/qr/lectura una vez montada la página; el
 * servidor resuelve el perfil desde la sesión (nunca desde el cliente) y
 * registra dispositivo/navegador desde el User-Agent real de la petición.
 * Un fallo no afecta al flujo de reporte.
 */
export function RegistrarLecturaQr({ codigo }: { codigo: string }) {
  useEffect(() => {
    const controlador = new AbortController();
    fetch("/api/qr/lectura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
      signal: controlador.signal,
    }).catch(() => {
      // Silencioso: la lectura es telemetría, no bloquea el reporte.
    });
    return () => controlador.abort();
  }, [codigo]);

  return null;
}
