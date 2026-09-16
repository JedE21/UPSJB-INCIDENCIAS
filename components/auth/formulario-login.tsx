"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, LogIn, ShieldCheck } from "lucide-react";
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
import { iniciarSesion } from "@/lib/auth/actions";
import type { EstadoAccion } from "@/lib/auth/types";

const estadoInicial: EstadoAccion = { error: null };

export function FormularioLogin({ siguiente }: { siguiente?: string }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, estadoInicial);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
        </div>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>
          Acceso para personal autorizado del sistema de incidencias.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="flex flex-col gap-4">
          {siguiente ? <input type="hidden" name="siguiente" value={siguiente} /> : null}

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
            <Label htmlFor="correo">Correo institucional</Label>
            <Input
              id="correo"
              name="correo"
              type="email"
              autoComplete="email"
              placeholder="usuario@upsjb.edu.pe"
              required
              disabled={pendiente}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contrasena">Contraseña</Label>
            <Input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={pendiente}
            />
          </div>

          <Button type="submit" disabled={pendiente}>
            {pendiente ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Verificando…
              </>
            ) : (
              <>
                <LogIn className="size-4" aria-hidden />
                Iniciar sesión
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <a href="/recuperar" className="text-muted-foreground underline-offset-4 hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
            <span className="text-muted-foreground">
              ¿Sin cuenta? <a href="/informacion" className="underline-offset-4 hover:underline">Ver información</a>
            </span>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Los estudiantes no necesitan cuenta para reportar o consultar incidencias.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
