import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileSearch,
  Info,
  MapPin,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/site";

const steps = [
  {
    icon: QrCode,
    title: "1. Escanea el QR",
    description: "Cada ambiente cuenta con un código QR único ubicado en un lugar visible.",
  },
  {
    icon: ClipboardList,
    title: "2. Reporta la incidencia",
    description: "El sistema identifica automáticamente el ambiente; solo describe el problema.",
  },
  {
    icon: FileSearch,
    title: "3. Haz seguimiento",
    description: "Recibe un código único y consulta el estado de tu reporte en cualquier momento.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero — concepto §27 del Plan Maestro */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
          <FadeIn>
            <div className="flex size-20 items-center justify-center rounded-2xl border bg-card shadow-sm">
              <ShieldCheck className="size-10 text-primary" aria-hidden />
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              {siteConfig.institution} · {siteConfig.branch}
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              {siteConfig.title}
              <span className="block text-primary">{siteConfig.name}</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.15}>
            <p className="max-w-xl text-balance text-muted-foreground">
              Reporta y realiza seguimiento de incidencias de manera rápida y sencilla.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="lg">
                <Link href="/reportar">
                  Reportar incidencia
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/seguimiento">Consultar incidencia</Link>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.25}>
            <Link
              href="/informacion"
              className="flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <Info className="size-4" aria-hidden />
              ¿Cómo funciona? Ver información del sistema
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Cómo funciona — sección QR */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <FadeIn>
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            ¿Cómo funciona?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
            Un reporte aislado se convierte en un proceso trazable: registro, clasificación,
            asignación, atención, resolución y cierre.
          </p>
        </FadeIn>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.title} delay={0.1 + i * 0.1}>
              <Card className="h-full">
                <CardContent className="flex flex-col items-center gap-3 text-center">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                    <step.icon className="size-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Ubicación automática por QR */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          <FadeIn>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Ubicación automática desde el QR
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Al escanear el código del ambiente, el sistema identifica sede, pabellón y
                ambiente automáticamente. No necesitas escribir manualmente dónde ocurre el
                problema.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Card>
              <CardContent className="flex flex-col gap-2 font-mono text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden /> Filial Ica
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden /> Pabellón B
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden /> Piso 1
                </span>
                <span className="flex items-center gap-2 font-medium">
                  <MapPin className="size-4 text-primary" aria-hidden /> Aula B-104
                </span>
                <span className="mt-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Identificado automáticamente desde el QR
                </span>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
