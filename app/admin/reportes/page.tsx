import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Reportes — Admin" };

export default function AdminReportesPage() {
  return (
    <PlaceholderPage
      icon={BarChart3}
      title="Reportes y analítica"
      description="Dashboards, KPIs, gráficos y exportaciones. Se implementa en la FASE 10."
    />
  );
}
