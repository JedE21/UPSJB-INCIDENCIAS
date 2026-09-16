import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Dashboard técnico" };

export default function TecnicoDashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Dashboard del técnico"
      description="Indicadores de incidencias pendientes, urgentes, en proceso y resueltas, con la lista de incidencias asignadas. Se implementa en la FASE 6."
    />
  );
}
