import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";

/**
 * Página placeholder reutilizable para módulos que se implementan
 * en fases posteriores del proyecto.
 */
export function PlaceholderPage({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <FadeIn>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="size-6 text-primary" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {description ??
              "Módulo en construcción. Se implementará en fases posteriores del proyecto."}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Construction className="size-3.5" aria-hidden />
            Módulo pendiente — se activa con su fase del Plan Maestro
          </p>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
