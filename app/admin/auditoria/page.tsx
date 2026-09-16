import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Auditoría — Admin" };

export default function AdminAuditoriaPage() {
  return (
    <PlaceholderPage
      icon={ScrollText}
      title="Auditoría del sistema"
      description="Registros de acciones importantes del sistema. Se implementa en la FASE 11."
    />
  );
}
