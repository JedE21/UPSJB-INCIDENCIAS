"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { restablecerContrasena } from "@/lib/auth/actions";
import type { EstadoAccion } from "@/lib/auth/types";

const estadoInicial: EstadoAccion = { error: null };

export function FormularioRestablecer() {
  const [estado, accion, pendiente] = useActionState(restablecerContrasena, estadoInicial);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <LockKeyhole className="size-5 text-primary" aria-hidden />
        </div>
        <CardTitle>Nueva contraseña</CardTitle>
        <CardDescription>Define tu nueva contraseña para tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="flex flex-col gap-4">
          {estado.error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {estado.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="contrasena">Nueva contraseña</Label>
            <Input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              required
              disabled={pendiente}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmacion">Confirmar contraseña</Label>
            <Input
              id="confirmacion"
              name="confirmacion"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Repite la contraseña"
              required
              disabled={pendiente}
            />
          </div>

          <Button type="submit" disabled={pendiente}>
            {pendiente ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" aria-hidden />
                Guardar contraseña
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
