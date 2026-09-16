import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Dashboard coordinador" };

export default function CoordinadorDashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Dashboard del coordinador"
      description="Supervisión de incidencias por área, asignación de técnicos, prioridades y SLA. Se implementa en la FASE 8."
    />
  );
}
