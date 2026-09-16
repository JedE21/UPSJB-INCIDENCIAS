import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Infraestructura — Admin" };

export default function AdminInfraestructuraPage() {
  return (
    <PlaceholderPage
      icon={Building2}
      title="Gestión de infraestructura"
      description="Sedes, pabellones, pisos, ambientes, aulas y laboratorios. Se implementa en la FASE 7."
    />
  );
}
