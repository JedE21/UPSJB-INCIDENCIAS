import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSesion } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";
import { perfilDeRoles } from "@/lib/auth/roles";

/**
 * SEO (Fase 14): el grupo público SÍ es indexable (el root layout bloquea
 * por defecto; aquí se re-habilita para estas rutas y robots.ts afina).
 */
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // En rutas públicas la sesión es opcional: solo personaliza el header.
  const sesion = await getSesion();

  return (
    <>
      <SiteHeader
        sesion={
          sesion
            ? {
                nombre: nombreCompleto(sesion.perfil),
                rol: sesion.roles[0] ?? "—",
                rutaPerfil: perfilDeRoles(sesion.roles),
              }
            : undefined
        }
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
