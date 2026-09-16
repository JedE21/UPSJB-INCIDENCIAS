"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarPerfil } from "@/lib/auth/actions";
import type { EstadoAccion, Perfil } from "@/lib/auth/types";

const estadoInicial: EstadoAccion = { error: null };

/**
 * Edición de datos complementarios (public.perfiles vía RLS).
 * El correo NO es editable aquí: es una credencial de Supabase Auth.
 */
export function FormularioPerfil({ perfil }: { perfil: Perfil }) {
  const [estado, accion, pendiente] = useActionState(actualizarPerfil, estadoInicial);

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2">
      {estado.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {estado.error}
        </p>
      ) : null}
      {estado.exito ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm sm:col-span-2"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {estado.exito}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="nombres">Nombres</Label>
        <Input id="nombres" name="nombres" defaultValue={perfil.nombres} required disabled={pendiente} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="apellido_paterno">Apellido paterno</Label>
        <Input
          id="apellido_paterno"
          name="apellido_paterno"
          defaultValue={perfil.apellido_paterno}
          required
          disabled={pendiente}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="apellido_materno">Apellido materno</Label>
        <Input
          id="apellido_materno"
          name="apellido_materno"
          defaultValue={perfil.apellido_materno ?? ""}
          disabled={pendiente}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="documento">Documento (DNI)</Label>
        <Input
          id="documento"
          name="documento"
          defaultValue={perfil.documento ?? ""}
          inputMode="numeric"
          disabled={pendiente}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          id="telefono"
          name="telefono"
          type="tel"
          defaultValue={perfil.telefono ?? ""}
          placeholder="9xx xxx xxx"
          disabled={pendiente}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="correo">Correo (no editable)</Label>
        <Input id="correo" value={perfil.correo} disabled readOnly />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden />
              Guardar cambios
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
