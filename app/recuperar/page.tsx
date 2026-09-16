import type { Metadata } from "next";
import { FormularioRecuperar } from "@/components/auth/formulario-recuperar";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <FormularioRecuperar />
    </main>
  );
}
