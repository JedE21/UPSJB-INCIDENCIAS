import type { Metadata } from "next";
import Image from "next/image";
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
    <main className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
      {/* Fondo: campus universitario (Filial Ica) */}
      <Image
        src="/filial-ica.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 object-cover object-center"
      />
      {/* Velo oscuro institucional: difumina la foto y la funde con el fondo
          hacia abajo para que la tarjeta resalte y el texto sea legible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background/55"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/40 via-transparent to-background"
      />

      {params.cerrado ? (
        <p
          role="status"
          className="rounded-md border border-border bg-card/90 px-4 py-2 text-sm text-muted-foreground backdrop-blur-md"
        >
          Sesión cerrada correctamente.
        </p>
      ) : null}
      {params.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive backdrop-blur-md"
        >
          El enlace no es válido o expiró. Inicia sesión normalmente.
        </p>
      ) : null}
      <FormularioLogin siguiente={siguiente} />

      <p className="absolute bottom-4 right-4 hidden text-[11px] text-muted-foreground/80 sm:block">
        Campus universitario — Filial Ica
      </p>
    </main>
  );
}
