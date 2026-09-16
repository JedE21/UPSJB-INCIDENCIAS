import type { Metadata } from "next";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cuenta suspendida" };

/** Sesión válida pero perfiles.estado = 'suspendido' (RLS también bloquea datos). */
export default function CuentaSuspendidaPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
        <ShieldOff className="size-6 text-destructive" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Cuenta suspendida</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Tu cuenta no está activa. Si crees que se trata de un error, comunícate con el
        administrador del sistema de incidencias de la Filial Ica.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
