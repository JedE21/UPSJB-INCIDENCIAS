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
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Nota adicional bajo el valor (tendencia, contexto…). */
  hint?: string;
  className?: string;
  /** Retardo de la animación de aparición (segundos). */
  delay?: number;
}) {
  return (
    <FadeIn delay={delay} className={className}>
      <Card className="h-full gap-0 py-5">
        <CardContent className="flex flex-col gap-3 px-5">
          {Icon ? (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
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
