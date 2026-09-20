import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth/session";
import { CopiarCodigo } from "@/components/incidencias/copiar-codigo";
import {
  ArrowRight,
  CircleCheck,
  FileSearch,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { StatusBadge } from "@/components/incidencias/badges";

export const metadata: Metadata = { title: "Reporte registrado" };

interface Props {
  /** Código único real devuelto por la Server Action de creación. */
  searchParams: Promise<{ codigo?: string }>;
}

/** Valida el formato del código institucional (generado por trigger de BD). */
const CODIGO_REGEX = /^INC-\d{4}-\d{4,6}$/;

/**
 * CONFIRMACIÓN DE REPORTE (§29 del Plan Maestro).
 * Recibe el código REAL generado por la base de datos (secuencia anual
 * atómica, sin colisiones). Verifica en servidor que la incidencia exista y
 * que el lector tenga visibilidad (RLS): si no, muestra aviso de verificación
 * en lugar de un código falso.
 */
export default async function ConfirmacionReportePage({ searchParams }: Props) {
  const { codigo } = await searchParams;
  const codigoLimpio = (codigo ?? "").trim().toUpperCase();

  // Verificación en servidor: la fila debe existir Y ser visible para el
  // lector (RLS). Un código inventado no pasa esta comprobación.
  let verificada: { estado: string | null } | null = null;
  if (CODIGO_REGEX.test(codigoLimpio)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("incidencias")
      .select("codigo, estados_incidencia ( nombre )")
      .eq("codigo", codigoLimpio)
      .maybeSingle<{ codigo: string; estados_incidencia: { nombre: string } | null }>();
    if (data) {
      verificada = { estado: data.estados_incidencia?.nombre ?? null };
    }
  }

  const mostrarExito = Boolean(verificada);

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      {mostrarExito ? (
        <>
          <FadeIn>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
                <CircleCheck className="size-7 text-green-600 dark:text-green-400" aria-hidden />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Incidencia registrada</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Tu reporte fue recibido correctamente. Guarda el código siguiente para consultar
                su estado en cualquier momento.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Card className="mt-8">
              <CardHeader>
                <CardDescription>Código de incidencia</CardDescription>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <CardTitle
                    className="select-all font-mono text-3xl tracking-wide"
                    aria-label={`Código de incidencia ${codigoLimpio}`}
                  >
                    {codigoLimpio}
                  </CardTitle>
                  <CopiarCodigo codigo={codigoLimpio} />
                </div>
                <div className="pt-1">
                  <StatusBadge estado={verificada?.estado} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild className="flex-1">
                    <Link href={`/seguimiento?codigo=${encodeURIComponent(codigoLimpio)}`}>
                      <FileSearch aria-hidden />
                      Consultar seguimiento
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/reportar">
                      <QrCode aria-hidden />
                      Reportar otra incidencia
                    </Link>
                  </Button>
                </div>

              <p className="text-center text-xs text-muted-foreground">
                Consejo: también puedes consultar el estado desde “Mis incidencias”
                si iniciaste sesión antes de reportar.
              </p>
              </CardContent>
            </Card>
          </FadeIn>
        </>
      ) : (
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">No pudimos verificar el reporte</CardTitle>
              <CardDescription>
                {codigoLimpio
                  ? `El código ${codigoLimpio} no corresponde a un reporte visible para tu cuenta.`
                  : "Falta el código del reporte."}{" "}
                Si acabas de enviar el formulario, espera unos segundos y consulta el seguimiento;
                si el problema persiste, verifica en “Mis incidencias”.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/seguimiento">
                  <FileSearch aria-hidden />
                  Ir a seguimiento
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/mis-incidencias">
                  Ver mis incidencias
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
