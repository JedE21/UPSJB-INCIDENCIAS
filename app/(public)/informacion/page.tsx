import type { Metadata } from "next";
import Link from "next/link";
import {
  Accessibility,
  ClipboardList,
  FileSearch,
  Info,
  Lock,
  QrCode,
  ScanLine,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Información",
  description:
    "Cómo funciona el sistema de incidencias de la UPSJB Filial Ica: QR, reportes, seguimiento y cobertura.",
};

const pasos = [
  {
    icon: ScanLine,
    title: "1. Escanea el QR del ambiente",
    description:
      "Cada aula, laboratorio y oficina tiene un código QR visible. Al escanearlo, el sistema identifica automáticamente sede, pabellón, piso y ambiente.",
  },
  {
    icon: ClipboardList,
    title: "2. Describe qué pasó",
    description:
      "Elige el tipo de problema, cuéntalo con tus palabras y adjunta una foto si quieres. No necesitas escribir la ubicación: el QR ya la proporciona.",
  },
  {
    icon: FileSearch,
    title: "3. Sigue tu reporte",
    description:
      "Al enviar recibirás un código único (INC-AAAA-NNNNNN). Con él puedes consultar en cualquier momento el estado y el historial de atención.",
  },
];

const preguntas = [
  {
    pregunta: "¿Necesito una cuenta para reportar?",
    respuesta:
      "No. Cualquier persona dentro de la filial puede reportar escaneando el QR del ambiente. Con una cuenta, además, verás tus reportes en “Mis incidencias” y recibirás notificaciones de su avance.",
  },
  {
    pregunta: "¿Qué información debo proporcionar?",
    respuesta:
      "Solo lo necesario: qué pasó, con qué equipo (si aplica) y una descripción breve. La ubicación se detecta desde el QR y la foto es opcional.",
  },
  {
    pregunta: "¿Cómo hago seguimiento sin cuenta?",
    respuesta:
      "Con el código que recibiste al enviar el reporte. Ingrésalo en la página “Consultar incidencia” para ver estado, ambiente, fecha e historial.",
  },
  {
    pregunta: "¿Qué tipos de problemas puedo reportar?",
    respuesta:
      "Técnicos (computadoras, proyectores), conectividad, infraestructura, mobiliario, limpieza, seguridad y otros. Si no sabes cómo clasificarlo, elige “Otro”.",
  },
];

/**
 * INFORMACIÓN — página pública orientativa.
 * Describe el uso del sistema; NO incluye tiempos de atención ni procedimientos
 * institucionales (SLA, áreas, reglas), que quedan pendientes de validación con
 * la Filial Ica (Plan Maestro §19.2, §17.1).
 */
export default function InformacionPage() {
  return (
    <div className="mx-auto w-full max-w-4xl py-8">
      <PageHeader
        icon={Info}
        title="Información"
        description={`Cómo funciona ${siteConfig.name} en la ${siteConfig.branch}.`}
      />

      <div className="flex flex-col gap-10">
        {/* Flujo de uso */}
        <section aria-labelledby="como-funciona-titulo" className="flex flex-col gap-4">
          <h2 id="como-funciona-titulo" className="text-lg font-semibold">
            ¿Cómo funciona?
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {pasos.map((paso, i) => (
              <FadeIn key={paso.title} delay={i * 0.08}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      <paso.icon className="size-5 text-primary" aria-hidden />
                    </div>
                    <CardTitle className="text-base">{paso.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{paso.description}</CardDescription>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Cómo reportar */}
        <section aria-labelledby="como-reportar-titulo" className="flex flex-col gap-4">
          <h2 id="como-reportar-titulo" className="text-lg font-semibold">
            Cómo reportar una incidencia
          </h2>
          <Card>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <QrCode className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Escanea el QR del ambiente con la cámara de tu teléfono o entra a{" "}
                  <Link href="/reportar" className="font-medium text-primary underline-offset-4 hover:underline">
                    Reportar incidencia
                  </Link>
                  .
                </span>
              </p>
              <p className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Completa los tres pasos del formulario y envía. Recibirás un código de
                  incidencia inmediatamente.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <FileSearch className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Consulta el avance cuando quieras en{" "}
                  <Link href="/seguimiento" className="font-medium text-primary underline-offset-4 hover:underline">
                    Consultar incidencia
                  </Link>{" "}
                  con tu código.
                </span>
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Preguntas frecuentes */}
        <section aria-labelledby="faq-titulo" className="flex flex-col gap-4">
          <h2 id="faq-titulo" className="text-lg font-semibold">
            Preguntas frecuentes
          </h2>
          <div className="flex flex-col gap-3">
            {preguntas.map((p) => (
              <details
                key={p.pregunta}
                className="group rounded-xl border bg-card px-4 py-3 transition-colors open:bg-muted/30"
              >
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  {p.pregunta}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{p.respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Accesibilidad, privacidad y alcance */}
        <section aria-labelledby="compromisos-titulo" className="flex flex-col gap-4">
          <h2 id="compromisos-titulo" className="text-lg font-semibold">
            Sobre el sistema
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Accessibility className="size-4 text-primary" aria-hidden />
                  Accesible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Funciona en teléfonos, tabletas y computadoras. Los estados se muestran con
                  texto e iconos, no solo con colores, y todo el sistema es navegable con teclado.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="size-4 text-primary" aria-hidden />
                  Tus datos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Solo se registra lo necesario para atender tu reporte. Las fotos son
                  opcionales y tu sesión se protege con las credenciales de tu cuenta.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScanLine className="size-4 text-primary" aria-hidden />
                  Cobertura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  El sistema inicia en la Filial Ica con QR en aulas, laboratorios y oficinas,
                  y está preparado para sumar otras sedes después.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
