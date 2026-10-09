import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContenidoPerfil } from "@/components/auth/contenido-perfil";
import { getSesionObligatoria } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil · Coordinador" };

/**
 * PERFIL del panel COORDINADOR.
 * Contenido compartido. Guard espejo: sin rol → al perfil de su panel.
 */
export default async function CoordinadorPerfilPage() {
  const sesion = await getSesionObligatoria();

  if (!sesion.roles.includes("COORDINADOR") && !sesion.roles.includes("SUPERVISOR")) {
    redirect("/perfil");
  }

  return <ContenidoPerfil sesion={sesion} />;
}
