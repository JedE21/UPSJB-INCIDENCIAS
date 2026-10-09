import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContenidoPerfil } from "@/components/auth/contenido-perfil";
import { getSesionObligatoria } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil técnico" };

/**
 * PERFIL del panel TÉCNICO.
 * Contenido compartido (components/auth/contendo-perfil). Guard espejo:
 * si la sesión no pertenece a este panel → a su panel correspondiente.
 * (Antes re-exportaba (usuario)/perfil, que hoy redirige a los admins.)
 */
export default async function TecnicoPerfilPage() {
  const sesion = await getSesionObligatoria();

  if (!sesion.roles.includes("TECNICO")) redirect("/perfil");

  return <ContenidoPerfil sesion={sesion} />;
}
