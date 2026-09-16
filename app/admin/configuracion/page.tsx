import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Configuración — Admin" };

export default function AdminConfiguracionPage() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Configuración del sistema"
      description="Catálogos, reglas de derivación, SLA y parámetros generales. Se implementa en la FASE 7."
    />
  );
}
