import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ListaMisIncidencias } from "@/components/usuario/lista-mis-incidencias";

export const metadata: Metadata = { title: "Mis incidencias" };

/**
 * MIS INCIDENCIAS — estructura visual (maqueta).
 * La lista real llegará de Supabase (incidencias del usuario, Fase 6) vía RLS;
 * los filtros de esta etapa son solo presentación.
 */
export default function MisIncidenciasPage() {
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

      <ListaMisIncidencias />

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
