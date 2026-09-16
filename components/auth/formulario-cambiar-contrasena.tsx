"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambiarContrasena } from "@/lib/auth/actions";
import type { EstadoAccion } from "@/lib/auth/types";

const estadoInicial: EstadoAccion = { error: null };

/** Cambio de contraseña con sesión activa; las credenciales las gestiona Supabase Auth. */
export function FormularioCambiarContrasena({ correo }: { correo: string }) {
  const [estado, accion, pendiente] = useActionState(cambiarContrasena, estadoInicial);

  return (
    <form action={accion} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="correo" value={correo} />

      {estado.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {estado.error}
        </p>
      ) : null}
      {estado.exito ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {estado.exito}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="actual">Contraseña actual</Label>
        <Input
          id="actual"
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          disabled={pendiente}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nueva">Nueva contraseña</Label>
        <Input
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          required
          disabled={pendiente}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmacion">Confirmar nueva contraseña</Label>
        <Input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={pendiente}
        />
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Actualizando…
          </>
        ) : (
          <>
            <KeyRound className="size-4" aria-hidden />
            Cambiar contraseña
          </>
        )}
      </Button>
    </form>
  );
}
