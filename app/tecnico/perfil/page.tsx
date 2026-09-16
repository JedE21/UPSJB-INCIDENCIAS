import PerfilPage from "@/app/(usuario)/perfil/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Perfil técnico" };

/**
 * Perfil del técnico: reutiliza la página de perfil (datos personales +
 * seguridad). Las especialidades y turnos se integran en la Fase 6.
 */
export default function TecnicoPerfilPage() {
  return <PerfilPage />;
}
