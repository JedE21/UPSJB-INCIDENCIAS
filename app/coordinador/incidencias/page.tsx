import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Incidencias — Coordinador" };

export default function CoordinadorIncidenciasPage() {
  return (
    <PlaceholderPage
      icon={ClipboardList}
      title="Incidencias del área"
      description="Supervisión, asignación y derivación de incidencias. Se implementa en las FASES 6–8."
    />
  );
}
