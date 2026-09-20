import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginaEntidad } from "@/components/admin/pagina-entidad";

export const metadata: Metadata = { title: "Infraestructura — Admin" };

/**
 * ADMIN · INFRAESTRUCTURA (FASE 7)
 * Ruta por defecto del grupo: muestra directamente la pestaña Sedes.
 */
export default function AdminInfraestructuraPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Building2}
        title="Infraestructura"
        description="Jerarquía física del campus: sedes → pabellones → pisos → ambientes, con detalle de aulas y laboratorios."
      />
      <Card>
        <CardHeader>
          <CardTitle>Gestión de infraestructura</CardTitle>
          <CardDescription>
            Administra la jerarquía completa de ubicaciones. La sede es la raíz: los códigos QR y las
            incidencias siempre apuntan a un ambiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginaEntidad grupo="infraestructura" slug="sedes" />
        </CardContent>
      </Card>
    </div>
  );
}
