import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Indicador de carga giratorio (Loader2 de Lucide) con animación CSS. */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2
      role="status"
      aria-label="Cargando"
      className={cn("size-4 animate-spin text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Spinner };
