"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { OpcionesFiltro } from "@/lib/reportes/datos";

/**
 * FILTROS DEL DASHBOARD DE REPORTES (FASE 10): fechas, sede, área, estado,
 * prioridad y tipo. Formulario GET: los filtros viven en la URL (compartibles
 * y re-parseados en servidor con validación estricta antes de tocar la BD).
 */
export function FiltrosReporteForm({ opciones }: { opciones: OpcionesFiltro }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [form, setForm] = useState({
    desde: "",
    hasta: "",
    sede: "",
    area: "",
    estado: "",
    prioridad: "",
    tipo: "",
  });

  // Precarga desde la URL actual (al entrar con filtros ya aplicados).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setForm({
      desde: sp.get("desde") ?? "",
      hasta: sp.get("hasta") ?? "",
      sede: sp.get("sede") ?? "",
      area: sp.get("area") ?? "",
      estado: sp.get("estado") ?? "",
      prioridad: sp.get("prioridad") ?? "",
      tipo: sp.get("tipo") ?? "",
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
      router.push(params.toString() ? `/admin/reportes?${params}` : "/admin/reportes");
    });
  }

  function limpiar() {
    setForm({ desde: "", hasta: "", sede: "", area: "", estado: "", prioridad: "", tipo: "" });
    iniciarTransicion(() => router.push("/admin/reportes"));
  }

  return (
    <form
      onSubmit={aplicar}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rep-desde">Desde</Label>
        <Input
          id="rep-desde"
          type="date"
          value={form.desde}
          onChange={(e) => set("desde")(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rep-hasta">Hasta</Label>
        <Input
          id="rep-hasta"
          type="date"
          value={form.hasta}
          onChange={(e) => set("hasta")(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rep-sede">Sede</Label>
        <Select id="rep-sede" value={form.sede} onChange={(e) => set("sede")(e.target.value)}>
          <option value="">Todas</option>
          {opciones.sedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rep-area">Área</Label>
        <Select id="rep-area" value={form.area} onChange={(e) => set("area")(e.target.value)}>
          <option value="">Todas</option>
          {opciones.areas.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rep-estado">Estado</Label>
        <Select id="rep-estado" value={form.estado} onChange={(e) => set("estado")(e.target.value)}>
          <option value="">Todos</option>
          {opciones.estados.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rep-prioridad">Prioridad</Label>
        <Select
          id="rep-prioridad"
          value={form.prioridad}
          onChange={(e) => set("prioridad")(e.target.value)}
        >
          <option value="">Todas</option>
          {opciones.prioridades.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rep-tipo">Tipo</Label>
        <Select id="rep-tipo" value={form.tipo} onChange={(e) => set("tipo")(e.target.value)}>
          <option value="">Todos</option>
          {opciones.tipos.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Select>
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
