"use client";

import * as React from "react";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { registrarSlasPendientes } from "@/lib/incidencias/sla-actions";

/**
 * Botón de BACKFILL del módulo SLA (Fase 8b): crea el snapshot de SLA de las
 * incidencias creadas antes de activar el módulo y estampa sus eventos ya
 * ocurridos. La autorización la re-decide la RPC 0017 (admin o coordinador
 * con gestionar_reglas); la UI solo ofrece la acción.
 */
export function BotonRegistrarSlas() {
  const { toast } = useToast();
  const [abierto, setAbierto] = React.useState(false);
  const [ejecutando, setEjecutando] = React.useState(false);

  const ejecutar = async () => {
    setEjecutando(true);
    try {
      const res = await registrarSlasPendientes();
      if (res.error) {
        toast({ title: "No se pudo completar", description: res.error, variant: "destructive" });
      } else {
        toast({
          title:
            res.registrados > 0
              ? `SLA registrado para ${res.registrados} incidencia(s)`
              : "No había incidencias pendientes de registro",
          variant: "success",
        });
        setAbierto(false);
      }
    } catch {
      toast({
        title: "Error de conexión",
        description: "Verifica tu red e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setEjecutando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
        <DatabaseZap aria-hidden />
        Registrar SLA pendientes
      </Button>
      <ConfirmDialog
        open={abierto}
        onClose={() => (ejecutando ? undefined : setAbierto(false))}
        onConfirm={ejecutar}
        title="Registrar SLA pendientes"
        description="Creará el snapshot de SLA de las incidencias que aún no lo tienen (según los acuerdos activos actuales) y estampará sus eventos ya ocurridos. Las incidencias sin acuerdo aplicable quedarán sin SLA."
        confirmLabel="Ejecutar"
        loading={ejecutando}
      />
    </>
  );
}
