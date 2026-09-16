"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { crearQr } from "@/lib/qr/actions";
import type { AmbienteDisponible } from "@/lib/qr/datos";

/**
 * Creación de QR (panel admin): el administrador elige el ambiente SIN QR
 * activo; el código y la URL /r/<codigo> los genera la base de datos
 * (trigger generar_codigo_qr_nuevo, migración 0003).
 */
export function FormularioCrearQr({ ambientes }: { ambientes: AmbienteDisponible[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [ambienteId, setAmbienteId] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);

  const alEnviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ambienteId) {
      toast({
        title: "Selecciona un ambiente",
        description: "Elige un ambiente activo que aún no tenga QR.",
        variant: "warning",
      });
      return;
    }
    setEnviando(true);
    const fd = new FormData();
    fd.set("ambiente_id", ambienteId);
    const res = await crearQr(null, fd);
    setEnviando(false);

    if (res.error) {
      toast({ title: "No se pudo crear el QR", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "QR creado", description: res.exito ?? undefined, variant: "success" });
    setAmbienteId("");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-4 text-primary" aria-hidden />
          Crear código QR
        </CardTitle>
        <CardDescription>
          Solo se listan ambientes activos sin QR vigente. El código (ICA-…-0001) y la URL se
          generan automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={alEnviar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="ambiente-qr">Ambiente</Label>
            <Select
              id="ambiente-qr"
              value={ambienteId}
              onChange={(e) => setAmbienteId(e.target.value)}
              disabled={ambientes.length === 0 || enviando}
              className="mt-1.5"
            >
              <option value="">
                {ambientes.length === 0
                  ? "No hay ambientes disponibles (todos tienen QR activo)"
                  : "Selecciona un ambiente…"}
              </option>
              {ambientes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} — {[a.sede, a.pabellon, a.piso].filter(Boolean).join(" · ")}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={enviando || ambientes.length === 0}>
            {enviando ? <Spinner className="text-current" /> : <Plus aria-hidden />}
            Crear QR
          </Button>
        </form>
        {ambientes.length > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {ambientes.length} ambiente(s) disponible(s) para asociar.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
