"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * ERROR BOUNDARY DEL PANEL ADMIN · captura fallos de render del servidor
 * (p. ej. caída de Supabase) con mensaje amigable y reintento.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] error de render:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <Alert variant="destructive" className="max-w-lg">
        <AlertTitle>No se pudo cargar esta sección</AlertTitle>
        <AlertDescription>
          Ocurrió un problema al consultar los datos. Reintenta; si persiste, verifica la conexión
          con el servicio o avísale al administrador del sistema.
        </AlertDescription>
      </Alert>
      <Button onClick={reset}>
        <RefreshCw aria-hidden />
        Reintentar
      </Button>
    </div>
  );
}
