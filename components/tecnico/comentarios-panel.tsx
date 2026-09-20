"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { agregarComentario } from "@/lib/incidencias/actions";
import { fechaHora } from "@/lib/fechas";
import type { IncidenciaDetalle } from "@/lib/incidencias/tipos";

/**
 * ComentariosPanel — hilo de comentarios con formulario de alta.
 * La autorización la aplica la RPC agregar_comentario (0013) en BD; el botón
 * solo se oculta si el lector no tiene el permiso en servidor.
 */
export function ComentariosPanel({
  incidenciaId,
  comentarios,
  puedeComentar,
  ocupado = false,
}: {
  incidenciaId: string;
  comentarios: IncidenciaDetalle["comentarios"];
  puedeComentar: boolean;
  ocupado?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [texto, setTexto] = React.useState("");
  const [interno, setInterno] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);

  const alEnviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const comentario = texto.trim();
    if (!comentario) return;

    setEnviando(true);
    try {
      const res = await agregarComentario(incidenciaId, comentario, interno);
      if (res.error) {
        toast({ title: "No se pudo comentar", description: res.error, variant: "destructive" });
      } else {
        setTexto("");
        toast({ title: "Comentario publicado", variant: "success" });
        router.refresh();
      }
    } catch {
      toast({
        title: "Error de conexión",
        description: "Verifica tu red e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4 text-primary" aria-hidden />
          Comentarios ({comentarios.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {comentarios.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {comentarios.map((c) => (
              <li key={c.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <span className="text-xs font-medium">{c.autor ?? "Usuario"}</span>
                  <span className="text-[10px] text-muted-foreground">{fechaHora(c.creado_en)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm">{c.comentario}</p>
                {c.es_interno ? (
                  <span className="mt-1.5 inline-flex items-center rounded-md border border-amber-300/60 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Nota interna (no visible al reportante)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p>
        )}

        {puedeComentar ? (
          <form onSubmit={alEnviar} noValidate className="flex flex-col gap-2">
            <Label htmlFor="comentario-tecnico" className="sr-only">
              Nuevo comentario
            </Label>
            <Textarea
              id="comentario-tecnico"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={3000}
              placeholder="Escribe un comentario para el reportante o el equipo…"
              disabled={enviando || ocupado}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={interno}
                onChange={(e) => setInterno(e.target.checked)}
                disabled={enviando || ocupado}
                className="size-3.5 rounded border-border accent-primary"
              />
              Nota interna (no la verá el reportante)
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">{texto.length}/3000</span>
              <Button
                type="submit"
                size="sm"
                disabled={enviando || ocupado || texto.trim().length === 0}
              >
                {enviando ? "Publicando…" : "Comentar"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
