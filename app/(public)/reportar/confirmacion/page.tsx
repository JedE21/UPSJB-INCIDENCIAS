import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, CircleCheck, FileSearch, QrCode } from "lucide-react";
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
  /** Datos del reporte enviados por el formulario (maqueta visual; sin BD). */
  searchParams: Promise<{
    tipo?: string;
    subtipo?: string;
    equipo?: string;
    fotos?: string;
    prioridad?: string;
    ambiente_id?: string;
    ambiente?: string;
    descripcion?: string;
  }>;
}

/** Código de incidencia mostrado en la maqueta (formato §14.1/Fase 6). */
const CODIGO_DEMO = "INC-2026-00128";

/** Muestra el ambiente: nombre visual (QR) o resolución por id en servidor. */
async function nombreAmbiente(params: { ambiente_id?: string; ambiente?: string }) {
  if (params.ambiente) return params.ambiente;
  if (params.ambiente_id && /^[0-9a-fA-F-]{36}$/.test(params.ambiente_id)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ambientes")
      .select("nombre")
      .eq("id", params.ambiente_id)
      .eq("activo", true)
      .maybeSingle<{ nombre: string }>();
    if (data?.nombre) return data.nombre;
  }
  return "—";
}

/**
 * CONFIRMACIÓN DE REPORTE (§29 del Plan Maestro).
 * Maqueta visual: el código es de ejemplo y los datos llegan por la URL;
 * cuando exista la lógica de incidencias (Fase 6) esta pantalla recibirá el
 * código real devuelto por la Server Action que crea la incidencia.
 */
export default async function ConfirmacionReportePage({ searchParams }: Props) {
  const datos = await searchParams;
  const ambiente = await nombreAmbiente(datos);

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
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
            <CardTitle
              className="select-all font-mono text-3xl tracking-wide"
              aria-label={`Código de incidencia ${CODIGO_DEMO}`}
            >
              {CODIGO_DEMO}
            </CardTitle>
            <div className="pt-1">
              <StatusBadge estado="Pendiente" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Ambiente</dt>
                <dd className="mt-0.5 font-medium">{ambiente}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Tipo</dt>
                <dd className="mt-0.5 font-medium">{datos.tipo ?? "—"}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Problema</dt>
                <dd className="mt-0.5 font-medium">{datos.subtipo ?? "—"}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Prioridad</dt>
                <dd className="mt-0.5 font-medium">{datos.prioridad ?? "—"}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Equipo relacionado</dt>
                <dd className="mt-0.5 font-medium">{datos.equipo ?? "—"}</dd>
                {datos.fotos && Number(datos.fotos) > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {datos.fotos} foto(s) adjunta(s) · la subida se habilita con la Fase 6.
                  </p>
                ) : null}
              </div>
              {datos.descripcion ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">Descripción</dt>
                  <dd className="mt-0.5">{datos.descripcion}</dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href={`/seguimiento?codigo=${encodeURIComponent(CODIGO_DEMO)}`}>
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

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowRight className="size-3.5" aria-hidden />
              También puedes escanear el QR de otro ambiente para reportar un problema nuevo.
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
