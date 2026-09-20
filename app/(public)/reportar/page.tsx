import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, QrCode, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reportar incidencia",
  description:
    "Escanea el QR del ambiente para reportar una incidencia con la ubicación ya identificada.",
};

/**
 * REPORTE · flujo principal Escanear QR → Reportar (§6 del Plan Maestro).
 *
 * Desde la Fase 6 el formulario exige un ambiente REAL resuelto en servidor:
 * se accede escaneando el QR del ambiente (/r/<codigo>). No se acepta un
 * ambiente enviado desde el navegador (seguridad del módulo QR) ni se pide
 * al usuario escribir sede/pabellón/piso (§49).
 */
export default function ReportarPage() {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <PageHeader
        icon={ClipboardList}
        title="Reportar incidencia"
        description="Escanea el QR del ambiente y cuéntanos qué pasó: la ubicación se identifica sola."
      />

      <Card>
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <ScanLine className="size-6 text-primary" aria-hidden />
          </div>
          <CardTitle className="mt-2 text-xl">Escanea el QR del ambiente</CardTitle>
          <CardDescription>
            Cada aula, laboratorio y oficina cuenta con un código QR institucional. Al escanearlo,
            el sistema identifica la sede, el pabellón, el piso y el ambiente, y abre el formulario
            de reporte con esos datos ya completos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              Abre la cámara de tu teléfono y apunta al QR del ambiente.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              Elige el tipo de problema, descríbelo brevemente y envía.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              Recibe tu código único y sigue el estado de tu reporte.
            </li>
          </ol>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
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
