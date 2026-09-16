import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelShell } from "@/components/layout/panel-shell";
import { getSesion } from "@/lib/auth/session";
import { homeDeRoles } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Acceso restringido" };

interface Props {
  searchParams: Promise<{ panel?: string }>;
}

/**
 * Aviso cuando la sesión es válida pero el panel no corresponde al rol.
 * Debe existir sesión (el middleware/guards redirigen a /login si no).
 */
export default async function AccesoRestringidoPage({ searchParams }: Props) {
  const [{ panel }, sesion] = await Promise.all([searchParams, getSesion()]);

  const mapaPaneles: Record<string, string> = {
    usuario: "usuarios",
    tecnico: "técnicos",
    coordinador: "coordinadores",
    admin: "administradores",
  };
  const destinatarios = (panel && mapaPaneles[panel]) || "otro perfil de usuario";

  return (
    <PanelShell context="usuario">
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10">
          <ShieldAlert className="size-6 text-amber-600" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">Acceso restringido</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Esta sección está reservada a {destinatarios}. Tu cuenta corresponde a otro panel del
          sistema.
        </p>
        <Button asChild>
          <Link href={sesion ? homeDeRoles(sesion.roles) : "/login"}>Ir a mi panel</Link>
        </Button>
      </div>
    </PanelShell>
  );
}
