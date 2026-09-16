import * as React from "react";
import { CircleAlert, CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Alertas informativas (estilo shadcn/ui). El icono refuerza el tipo de alerta
 * para no depender únicamente del color (principio de accesibilidad §50).
 */
const variantes = {
  info: {
    icon: Info,
    clases:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400",
  },
  success: {
    icon: CircleCheck,
    clases:
      "border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200 [&>svg]:text-green-600 dark:[&>svg]:text-green-400",
  },
  warning: {
    icon: TriangleAlert,
    clases:
      "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400",
  },
  destructive: {
    icon: CircleAlert,
    clases:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 [&>svg]:text-red-600 dark:[&>svg]:text-red-400",
  },
} as const;

export interface AlertProps extends React.ComponentProps<"div"> {
  variant?: keyof typeof variantes;
  icon?: boolean;
}

function Alert({ className, variant = "info", icon = true, children, ...props }: AlertProps) {
  const { icon: IconPorDefecto, clases } = variantes[variant];

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        "relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5",
        clases,
        className
      )}
      {...props}
    >
      {icon ? <IconPorDefecto aria-hidden /> : null}
      <div className="min-w-0 flex-1 [&>p]:leading-relaxed">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-title"
      className={cn("font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm opacity-90", className)}
      {...props}
    />
  );
}

/** Iconos expuestos por si una alerta necesita un icono personalizado. */
export { Alert, AlertTitle, AlertDescription, CircleX as IconoErrorAlerta };
