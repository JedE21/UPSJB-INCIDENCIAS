import type { Metadata } from "next";
import { Timer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginaEntidad } from "@/components/admin/pagina-entidad";
import { BotonRegistrarSlas } from "@/components/admin/boton-registrar-slas";

export const metadata: Metadata = { title: "Acuerdos SLA — Admin" };

/**
 * ADMIN · ACUERDOS SLA (Fase 8b — Plan Maestro §19).
 * Objetivos de respuesta/resolución por prioridad (+ especialización por
 * tipo). CONFIGURABLES: ningún tiempo está hardcodeado; la semilla 0005 está
 * marcada [VI] y NO constituye política oficial de la UPSJB. La policy
 * p_sla_admin (0007: admin o coordinador con gestionar_reglas) autoriza en
 * BD; el guardia del grupo `configuracion` filtra antes.
 */
export default function AdminSlaPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Timer}
        title="Acuerdos de nivel de servicio (SLA)"
        description="Tiempos objetivo de respuesta y resolución por prioridad y tipo de incidencia."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Acuerdos SLA</CardTitle>
              <CardDescription className="mt-1">
                La especialización por tipo pisa al acuerdo base de la prioridad. El cómputo
                actual es en HORAS CORRIDAS desde el reporte; el cálculo hábil (feriados/turnos)
                queda pendiente de validación institucional. Los umbrales de alerta («en riesgo»)
                son técnicos y no constituyen política institucional.
              </CardDescription>
            </div>
            <BotonRegistrarSlas />
          </div>
        </CardHeader>
        <CardContent>
          <PaginaEntidad grupo="configuracion" slug="sla" />
        </CardContent>
      </Card>
    </div>
  );
}
