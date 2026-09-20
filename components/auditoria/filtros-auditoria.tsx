"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ACCIONES_AUDITORIA } from "@/lib/auditoria/constantes";

/**
 * FILTROS DE LA CONSULTA ADMINISTRATIVA DE AUDITORÍA (Fase 11): acción,
 * tabla, búsqueda libre y rango de fechas. GET → URL compartible; el
 * servidor re-valida todo antes de consultar la BD.
 */
export function FiltrosAuditoriaForm({ tablaInicial }: { tablaInicial?: string }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [form, setForm] = useState({
    accion: "",
    tabla: tablaInicial ?? "",
    q: "",
    desde: "",
    hasta: "",
  });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setForm({
      accion: sp.get("accion") ?? "",
      tabla: sp.get("tabla") ?? "",
      q: sp.get("q") ?? "",
      desde: sp.get("desde") ?? "",
      hasta: sp.get("hasta") ?? "",
    });
  }, []);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (v) params.set(k, v);
    }
    iniciarTransicion(() => {
      router.push(params.toString() ? `/admin/auditoria?${params}` : "/admin/auditoria");
    });
  }

  function limpiar() {
    setForm({ accion: "", tabla: "", q: "", desde: "", hasta: "" });
    iniciarTransicion(() => router.push("/admin/auditoria"));
  }

  return (
    <form
      onSubmit={aplicar}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aud-accion">Acción</Label>
        <Select id="aud-accion" value={form.accion} onChange={(e) => set("accion")(e.target.value)}>
          <option value="">Todas</option>
          {ACCIONES_AUDITORIA.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aud-tabla">Tabla afectada</Label>
        <Input
          id="aud-tabla"
          placeholder="p. ej. incidencias"
          value={form.tabla}
          onChange={(e) => set("tabla")(e.target.value)}
          maxLength={63}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aud-desde">Desde</Label>
        <Input
          id="aud-desde"
          type="date"
          value={form.desde}
          onChange={(e) => set("desde")(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aud-hasta">Hasta</Label>
        <Input
          id="aud-hasta"
          type="date"
          value={form.hasta}
          onChange={(e) => set("hasta")(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="aud-q">Búsqueda (código o contenido JSON)</Label>
        <Input
          id="aud-q"
          placeholder="p. ej. INC-2026-000128"
          value={form.q}
          onChange={(e) => set("q")(e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pendiente} className="gap-2">
          <Filter className="size-4" aria-hidden />
          {pendiente ? "Aplicando…" : "Aplicar"}
        </Button>
        <Button type="button" variant="outline" onClick={limpiar} disabled={pendiente} className="gap-2">
          <RotateCcw className="size-4" aria-hidden />
          Limpiar
        </Button>
      </div>
    </form>
  );
}
