import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ListaMisIncidencias } from "@/components/usuario/lista-mis-incidencias";
import { listarMisIncidencias } from "@/lib/incidencias/datos";

export const metadata: Metadata = { title: "Mis incidencias" };

/**
 * MIS INCIDENCIAS — versión real (Fase 6).
 * La lista viene de Supabase con RLS: el usuario solo ve lo que le corresponde
 * (p_incidencias_select); no existe DELETE en la aplicación.
 */
export default async function MisIncidenciasPage() {
  const incidencias = await listarMisIncidencias();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        title="Mis incidencias"
        description="Reportes que registraste y su estado actual."
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
        ¿Tienes un problema nuevo? Escanea el QR del ambiente o usa{" "}
        <Link
          href="/reportar"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Reportar incidencia
        </Link>
        .
      </p>
    </div>
  );
}
