import type { Metadata } from "next";
import { Cpu } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Equipos — Admin" };

export default function AdminEquiposPage() {
  return (
    <PlaceholderPage
      icon={Cpu}
      title="Gestión de equipos"
      description="Inventario de equipos, estados, ubicaciones y movimientos. Se implementa en la FASE 7."
    />
  );
}
