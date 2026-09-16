import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Incidencias — Admin" };

export default function AdminIncidenciasPage() {
  return (
    <PlaceholderPage
      icon={ClipboardList}
      title="Gestión de incidencias"
      description="Listado completo de incidencias del sistema con filtros y acciones administrativas. Se implementa en la FASE 7."
    />
  );
}
