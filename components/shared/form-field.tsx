import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * FormField — envoltorio estándar de campo de formulario:
 * label + control + error + hint, con IDs correctamente asociados.
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  /** ID del control (input/select/textarea) para el <label htmlFor>. */
  htmlFor: string;
  /** Mensaje de error (reemplaza al hint; aria-describedby automático). */
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
  className?: string;
}) {
  const idHint = `${htmlFor}-hint`;
  const idError = `${htmlFor}-error`;
  const descrito = error ? idError : hint ? idHint : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {" "}*
          </span>
        ) : null}
      </Label>
      {React.cloneElement(children, {
        id: htmlFor,
        "aria-describedby": descrito,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={idError} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={idHint} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
