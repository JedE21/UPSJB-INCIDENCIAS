import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Usuarios — Admin" };

export default function AdminUsuariosPage() {
  return (
    <PlaceholderPage
      icon={Users}
      title="Gestión de usuarios"
      description="Usuarios, roles y permisos del sistema. Se implementa en la FASE 7."
    />
  );
}
