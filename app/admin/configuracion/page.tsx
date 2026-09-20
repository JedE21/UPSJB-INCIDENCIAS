import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginaEntidad } from "@/components/admin/pagina-entidad";

export const metadata: Metadata = { title: "Configuración — Admin" };

/**
 * ADMIN · CONFIGURACIÓN (Fase 8 — Plan Maestro §36: clasificación automática
 * configurable). Reglas de derivación gestionables: SI tipo (+ subtipo)
 * ENTONCES área (+ servicio). La policy p_reglas_admin (0007) autoriza en BD;
 * los cambios quedan en registros_auditoria (trigger 0016) y cada aplicación
 * de regla registra la regla usada en el historial de la incidencia.
 */
export default function AdminConfiguracionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Settings}
        title="Configuración del sistema"
        description="Reglas de clasificación y derivación automática de incidencias."
      />
      <Card>
        <CardHeader>
          <CardTitle>Reglas de derivación</CardTitle>
          <CardDescription>
            Ejemplo conceptual: SI tipo «Técnica» + subtipo «Internet» ENTONCES área «Sistemas» y
            servicio «Redes». Los casos no los define el código: los define aquí el administrador.
            Cuando ninguna regla coincide, la incidencia queda Pendiente para derivación manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginaEntidad grupo="configuracion" slug="reglas" />
        </CardContent>
      </Card>
    </div>
  );
}
