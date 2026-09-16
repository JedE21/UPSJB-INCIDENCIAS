import PerfilPage from "@/app/(usuario)/perfil/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Perfil" };

/** Perfil del coordinador: reutiliza la página de perfil (datos + seguridad). */
export default function CoordinadorPerfilPage() {
  return <PerfilPage />;
}
