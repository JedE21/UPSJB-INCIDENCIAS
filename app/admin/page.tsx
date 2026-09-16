import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Dashboard administrativo" };

export default function AdminDashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Dashboard administrativo"
      description="Vista general de la operación: incidencias, usuarios, infraestructura, equipos, QR y reportes. Se implementa en la FASE 7."
    />
  );
}
