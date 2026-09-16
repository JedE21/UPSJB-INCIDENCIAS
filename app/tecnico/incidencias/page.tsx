import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Incidencias asignadas" };

export default function TecnicoIncidenciasPage() {
  return (
    <PlaceholderPage
      icon={ClipboardList}
      title="Incidencias asignadas"
      description="Lista y filtros de las incidencias asignadas al técnico, con detalle de atención. Se implementa en la FASE 6."
    />
  );
}
