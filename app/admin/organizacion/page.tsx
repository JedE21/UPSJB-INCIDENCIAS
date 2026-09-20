import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginaEntidad } from "@/components/admin/pagina-entidad";

export const metadata: Metadata = { title: "Organización — Admin" };

/**
 * ADMIN · ORGANIZACIÓN (FASE 7)
 * Entrada del grupo: muestra directamente la pestaña Áreas.
 */
export default function AdminOrganizacionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Boxes}
        title="Organización"
        description="Áreas responsables, sus servicios y las especialidades de los técnicos."
      />
      <Card>
        <CardHeader>
          <CardTitle>Gestión organizacional</CardTitle>
          <CardDescription>
            Las áreas son el destino de las derivaciones; los servicios las especializan. Los
            técnicos se registran como personal operativo en la pestaña correspondiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginaEntidad grupo="organizacion" slug="areas" />
        </CardContent>
      </Card>
    </div>
  );
}
