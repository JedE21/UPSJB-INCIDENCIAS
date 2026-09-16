import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Organización — Admin" };

export default function AdminOrganizacionPage() {
  return (
    <PlaceholderPage
      icon={Boxes}
      title="Gestión organizacional"
      description="Áreas, servicios, técnicos, especialidades y turnos. Se implementa en la FASE 7."
    />
  );
}
