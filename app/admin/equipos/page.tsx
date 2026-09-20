import type { Metadata } from "next";
import { Cpu } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginaEntidad } from "@/components/admin/pagina-entidad";

export const metadata: Metadata = { title: "Equipos — Admin" };

/**
 * ADMIN · EQUIPOS (FASE 7)
 * Entrada del grupo: catálogos del inventario. El registro de equipos y sus
 * movimientos llega con el módulo completo de inventario.
 */
export default function AdminEquiposPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Cpu}
        title="Equipos"
        description="Catálogos del inventario: categorías, marcas y estados del ciclo de vida."
      />
      <Card>
        <CardHeader>
          <CardTitle>Catálogos de equipos</CardTitle>
          <CardDescription>
            Estas catálogos alimentan el registro de equipos y sus movimientos. El inventario
            detallado (equipos por ambiente, series y traslados) se activa con el módulo completo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginaEntidad grupo="equipos" slug="categorias" />
        </CardContent>
      </Card>
    </div>
  );
}
