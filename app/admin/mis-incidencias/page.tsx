import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ListaMisIncidencias } from "@/components/usuario/lista-mis-incidencias";
import { listarMisIncidencias } from "@/lib/incidencias/datos";

export const metadata: Metadata = { title: "Mis incidencias · Admin" };

/**
 * MIS INCIDENCIAS DEL PANEL ADMIN.
 * Listado de los reportes creados con la propia cuenta del administrador
 * (RLS p_incidencias_select: dueño). Reutiliza el mismo componente del panel
 * usuario, sin duplicar código. La gestión de TODAS las incidencias vive en
 * /admin/incidencias (p_perfiles_admin y policies correspondientes).
 */
export default async function AdminMisIncidenciasPage() {
  const incidencias = await listarMisIncidencias();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        title="Mis incidencias"
        description="Reportes que registraste y su estado actual (tu cuenta como reportante)."
        actions={
          <Button asChild>
            <Link href="/reportar">
              Reportar incidencia
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      <ListaMisIncidencias incidencias={incidencias} />

      <p className="text-xs text-muted-foreground">
        ¿Problema nuevo? Escanea el QR del ambiente o usa{" "}
        <Link href="/reportar" className="underline hover:text-foreground">
          reportar incidencia
        </Link>
        .
      </p>
    </div>
  );
}
