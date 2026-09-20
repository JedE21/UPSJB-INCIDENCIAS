import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

/**
 * StatCard — tarjeta de indicador para dashboards (§31, §34 del Plan Maestro):
 * etiqueta + valor grande + icono + nota opcional.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
  delay = 0,
  /** Semántica del indicador (refuerza el estado sin depender solo del color). */
  tono = "neutral",
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Nota adicional bajo el valor (tendencia, contexto…). */
  hint?: string;
  className?: string;
  /** Retardo de la animación de aparición (segundos). */
  delay?: number;
  /** neutro (por defecto) | alerta (riesgo) | peligro (vencido) | exito. */
  tono?: "neutral" | "alerta" | "peligro" | "exito";
}) {
  const bordeTono =
    tono === "peligro"
      ? "border-red-200 dark:border-red-500/30"
      : tono === "alerta"
        ? "border-amber-200 dark:border-amber-500/30"
        : tono === "exito"
          ? "border-green-200 dark:border-green-500/30"
          : "";
  const iconoTono =
    tono === "peligro"
      ? "bg-red-100 dark:bg-red-500/15 [&_svg]:text-red-600 dark:[&_svg]:text-red-400"
      : tono === "alerta"
        ? "bg-amber-100 dark:bg-amber-500/15 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400"
        : tono === "exito"
          ? "bg-green-100 dark:bg-green-500/15 [&_svg]:text-green-600 dark:[&_svg]:text-green-400"
          : "";

  return (
    <FadeIn delay={delay} className={className}>
      <Card className={cn("h-full gap-0 py-5", bordeTono)}>
        <CardContent className="flex flex-col gap-3 px-5">
          {Icon ? (
            <div className={cn("flex size-10 items-center justify-center rounded-lg bg-primary/10", iconoTono)}>
              <Icon className="size-5 text-primary" aria-hidden />
            </div>
          ) : null}
          <div>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{label}</p>
          </div>
          {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
