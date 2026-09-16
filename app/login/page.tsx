import type { Metadata } from "next";
import { FormularioLogin } from "@/components/auth/formulario-login";

export const metadata: Metadata = { title: "Iniciar sesión" };

interface Props {
  searchParams: Promise<{ siguiente?: string; error?: string; cerrado?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const siguiente =
    params.siguiente && params.siguiente.startsWith("/") && !params.siguiente.startsWith("//")
      ? params.siguiente
      : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
      {params.cerrado ? (
        <p
          role="status"
          className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground"
        >
          Sesión cerrada correctamente.
        </p>
      ) : null}
      {params.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          El enlace no es válido o expiró. Inicia sesión normalmente.
        </p>
      ) : null}
      <FormularioLogin siguiente={siguiente} />
    </main>
  );
}
