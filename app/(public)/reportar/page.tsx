import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, QrCode, ScanLine, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LectorQrWeb } from "@/components/qr/lector-qr-web";

export const metadata: Metadata = {
  title: "Reportar incidencia",
  description:
    "Escanea el QR del ambiente con tu cámara para reportar una incidencia con la ubicación ya identificada.",
};

/**
 * REPORTE · flujo principal Escanear QR → Reportar (§6 del Plan Maestro).
 *
 * Desde la Fase 6 el formulario exige un ambiente REAL resuelto en servidor:
 * se accede escaneando el QR del ambiente (/r/<codigo>), ahora también con el
 * lector integrado (cámara del navegador, detección local). No se acepta un
 * ambiente enviado desde el navegador (seguridad del módulo QR) ni se pide
 * al usuario escribir sede/pabellón/piso (§49).
 */
export default function ReportarPage() {
  return (
    <div className="relative mx-auto w-full max-w-2xl py-8">
      <div className="aurora-fondo" aria-hidden />

      <PageHeader
        icon={ClipboardList}
        title="Reportar incidencia"
        description="Escanea el QR del ambiente y cuéntanos qué pasó: la ubicación se identifica sola."
      />

      {/* Pill de estado (lenguaje del mockup): soporte siempre conectado. */}
      <div className="mb-5 flex justify-center">
        <span className="group inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary shadow-[0_0_24px_-8px_rgb(255_57_54/55%)] transition-colors hover:border-primary/45">
          <span className="live-dot" aria-hidden />
          <Wrench className="size-3.5" aria-hidden />
          Soporte Técnico conectado · Filial Ica
        </span>
      </div>

      {/* Lector QR integrado: la cámara se abre bajo pedido del usuario. */}
      <section aria-label="Escanear código QR con la cámara" className="mb-6">
        <LectorQrWeb />
      </section>

      <Card className="relative overflow-hidden transition-colors hover:border-primary/30">
        {/* Canto superior neón (lenguaje del mockup) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          aria-hidden
        />
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <ScanLine className="size-6 text-primary" aria-hidden />
          </div>
          <CardTitle className="mt-2 text-xl">¿Cómo funciona el QR institucional?</CardTitle>
          <CardDescription>
            Cada aula, laboratorio y oficina cuenta con un código QR institucional. Al escanearlo,
            el sistema identifica la sede, el pabellón, el piso y el ambiente, y abre el formulario
            de reporte con esos datos ya completos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-2 transition-colors">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary shadow-[0_0_14px_-4px_rgb(255_57_54/60%)]">
                1
              </span>
              Abre la cámara aquí mismo —o la de tu teléfono— y apunta al QR del ambiente.
            </li>
            <li className="flex items-start gap-2 transition-colors">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary shadow-[0_0_14px_-4px_rgb(255_57_54/60%)]">
                2
              </span>
              Elige el tipo de problema, descríbelo brevemente y envía.
            </li>
            <li className="flex items-start gap-2 transition-colors">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary shadow-[0_0_14px_-4px_rgb(255_57_54/60%)]">
                3
              </span>
              Recibe tu código único y sigue el estado de tu reporte.
            </li>
          </ol>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="btn-brillo">
              <Link href="/seguimiento">
                <QrCode aria-hidden />
                Ya tengo un código: consultar seguimiento
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            ¿El ambiente no tiene QR o el código aparece deshabilitado? Repórtalo en las oficinas
            de la filial.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
