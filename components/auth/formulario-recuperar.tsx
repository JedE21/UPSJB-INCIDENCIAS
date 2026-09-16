"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
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
import { recuperarContrasena } from "@/lib/auth/actions";
import type { EstadoAccion } from "@/lib/auth/types";

const estadoInicial: EstadoAccion = { error: null };

export function FormularioRecuperar() {
  const [estado, accion, pendiente] = useActionState(recuperarContrasena, estadoInicial);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <KeyRound className="size-5 text-primary" aria-hidden />
        </div>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>
          Te enviaremos un enlace para definir una nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {estado.exito ? (
          <div className="flex flex-col gap-4">
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {estado.exito}
            </p>
            <Button asChild variant="outline">
              <Link href="/login">
                <Mail className="size-4" aria-hidden />
                Volver a iniciar sesión
              </Link>
            </Button>
          </div>
        ) : (
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

            <Button type="submit" disabled={pendiente}>
              {pendiente ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                <>
                  <Mail className="size-4" aria-hidden />
                  Enviar enlace de recuperación
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/login" className="underline-offset-4 hover:underline">
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
