import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormularioRestablecer } from "@/components/auth/formulario-restablecer";

export const metadata: Metadata = { title: "Restablecer contraseña" };

interface Props {
  searchParams: Promise<{ estado?: string; error?: string }>;
}

/**
 * Llega desde:
 *  · /auth/callback?tipo=recuperacion (con sesión de recovery) → formulario.
 *  · enlace expirado/ya usado → ?error=enlace-invalido.
 *  · tras guardar con éxito → ?estado=exito.
 */
export default async function RestablecerPage({ searchParams }: Props) {
  const params = await searchParams;

  let contenido: React.ReactNode;

  if (params.estado === "exito") {
    contenido = (
      <div className="flex flex-col items-center gap-4 py-4">
        <CheckCircle2 className="size-10 text-primary" aria-hidden />
        <p className="text-center text-sm text-muted-foreground">
          Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión con la nueva
          contraseña.
        </p>
        <Button asChild>
          <Link href="/login">Ir a iniciar sesión</Link>
        </Button>
      </div>
    );
  } else if (params.error === "enlace-invalido") {
    contenido = (
      <div className="flex flex-col items-center gap-4 py-4">
        <LinkIcon className="size-10 text-muted-foreground" aria-hidden />
        <p className="text-center text-sm text-muted-foreground">
          El enlace no es válido o ya expiró (cada enlace se usa una sola vez). Solicita uno nuevo.
        </p>
        <Button asChild variant="outline">
          <Link href="/recuperar">Solicitar nuevo enlace</Link>
        </Button>
      </div>
    );
  } else {
    contenido = <FormularioRestablecer />;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Restablecer contraseña</CardTitle>
          <CardDescription>Definición de una nueva contraseña para tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>{contenido}</CardContent>
      </Card>
    </main>
  );
}
