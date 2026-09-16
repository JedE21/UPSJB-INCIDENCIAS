import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ClipboardList, KeyRound, ShieldCheck, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormularioPerfil } from "@/components/auth/formulario-perfil";
import { FormularioCambiarContrasena } from "@/components/auth/formulario-cambiar-contrasena";
import { getSesionObligatoria } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Perfil" };

/** PERFIL · datos complementarios (public.perfiles) + seguridad (Supabase Auth). */
export default async function PerfilPage() {
  const sesion = await getSesionObligatoria();

  if (!sesion.perfil) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perfil no disponible</CardTitle>
          <CardDescription>
            Tu perfil aún no fue creado. Comunícate con el administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos de tu cuenta en el sistema de incidencias.
        </p>
      </div>

      {/* Resumen de identidad + accesos rápidos */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="size-6 text-primary" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{nombreCompleto(sesion.perfil)}</p>
              <p className="truncate text-sm text-muted-foreground">{sesion.correo}</p>
              {sesion.perfil.codigo_usuario ? (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  Código: {sesion.perfil.codigo_usuario}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sesion.roles.length > 0 ? (
              sesion.roles.map((rol) => (
                <Badge key={rol} variant="secondary" className="uppercase tracking-wide">
                  <ShieldCheck className="size-3" aria-hidden />
                  {rol}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">SIN ROLES ASIGNADOS</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accesos rápidos (flujo usuario) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-auto justify-start py-3">
          <Link href="/mis-incidencias">
            <ClipboardList aria-hidden />
            Ver mis incidencias
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start py-3">
          <Link href="/notificaciones">
            <Bell aria-hidden />
            Ver notificaciones
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" aria-hidden />
            Datos personales
          </CardTitle>
          <CardDescription>
            Información complementaria almacenada en <code>perfiles</code>. Las credenciales las
            gestiona Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioPerfil perfil={sesion.perfil} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Seguridad
          </CardTitle>
          <CardDescription>
            Para cambiar tu contraseña confirmamos primero la actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioCambiarContrasena correo={sesion.correo} />
        </CardContent>
      </Card>
    </div>
  );
}
