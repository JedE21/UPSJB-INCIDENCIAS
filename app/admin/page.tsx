import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlarmClock,
  Building2,
  ClipboardList,
  Cpu,
  DoorOpen,
  Gauge,
  LayoutDashboard,
  QrCode,
  Timer,
  TriangleAlert,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/incidencias/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerDatosDashboardAdmin } from "@/lib/admin/datos";
import { obtenerIndicadoresSla } from "@/lib/incidencias/sla";
import { notificarAlertasSla } from "@/lib/notificaciones/alertas";
import { fechaHora } from "@/lib/fechas";

export const metadata: Metadata = { title: "Dashboard administrativo" };

/**
 * DASHBOARD ADMINISTRATIVO BASE (FASE 7 — §33/§34 del Plan Maestro, sin
 * analítica avanzada: esa llega en la Fase 10). KPIs contados en SERVIDOR
 * con RLS; desgloses simples por estado/tipo; acceso rápido a los módulos.
 */
export default async function AdminDashboardPage() {
  const [{ kpis, porEstado, porTipo, ultimas }, sla] = await Promise.all([
    obtenerDatosDashboardAdmin(),
    obtenerIndicadoresSla(),
  ]);

  // Cola de alertas SLA (RPC 0018): genera las notificaciones faltantes de
  // asignaciones vencidas/en riesgo (dedupe). Fallo no bloquea el dashboard.
  try {
    await notificarAlertasSla();
  } catch {
    // sin bloquear la carga
  }

  const maxEstado = Math.max(1, ...porEstado.map((s) => s.cantidad));
  const maxTipo = Math.max(1, ...porTipo.map((s) => s.cantidad));

  const modulos = [
    { href: "/admin/incidencias", label: "Incidencias", icon: ClipboardList, nota: `${kpis.incidenciasTotal} registradas` },
    { href: "/admin/usuarios", label: "Usuarios", icon: Users, nota: `${kpis.usuarios} activos` },
    { href: "/admin/roles", label: "Roles y permisos", icon: UserCog, nota: "Matriz editable" },
    { href: "/admin/infraestructura/sedes", label: "Sedes", icon: Building2, nota: `${kpis.sedesActivas} activas` },
    { href: "/admin/infraestructura/ambientes", label: "Ambientes", icon: DoorOpen, nota: `${kpis.ambientesActivos} activos` },
    { href: "/admin/equipos", label: "Equipos", icon: Cpu, nota: `${kpis.equiposRegistrados} registrados` },
    { href: "/admin/qr", label: "Códigos QR", icon: QrCode, nota: `${kpis.qrActivos} activos` },
    { href: "/admin/organizacion/tecnicos", label: "Técnicos", icon: Wrench, nota: `${kpis.tecnicos} operativos` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard administrativo"
        description="Vista general de la operación: incidencias, personas, infraestructura, equipos y QR."
      />

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Incidencias abiertas"
          value={kpis.incidenciasAbiertas}
          hint={`${kpis.incidenciasTotal} en total`}
          delay={0}
        />
        <StatCard icon={Users} label="Usuarios activos" value={kpis.usuarios} hint="Cuentas con sesión habilitada" delay={0.05} />
        <StatCard icon={Wrench} label="Técnicos operativos" value={kpis.tecnicos} hint="Registrados y activos" delay={0.1} />
        <StatCard icon={QrCode} label="QR activos" value={kpis.qrActivos} hint={`${kpis.ambientesActivos} ambientes activos`} delay={0.15} />
      </div>

      {/* SLA e indicadores de tiempo (Fase 8b — Plan §47; RPC 0017) */}
      {sla.autorizado ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">SLA e indicadores de tiempo</CardTitle>
              <span className="text-xs text-muted-foreground">
                Valores del acuerdo configurables [no son política oficial UPSJB]
              </span>
            </div>
            <CardDescription>
              Respuesta = reporte → inicio de atención · Atención = inicio → resolución ·
              Resolución = reporte → resolución (horas corridas).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Timer}
                label="Respuesta promedio"
                value={sla.promHorasRespuesta !== null ? `${sla.promHorasRespuesta} h` : "—"}
                hint="Primer valor estampado gana (aceptar)."
                delay={0}
              />
              <StatCard
                icon={Activity}
                label="Atención promedio"
                value={sla.promHorasAtencion !== null ? `${sla.promHorasAtencion} h` : "—"}
                hint="Inicio → resolución."
                delay={0.05}
              />
              <StatCard
                icon={Gauge}
                label="Resolución promedio"
                value={sla.promHorasResolucion !== null ? `${sla.promHorasResolucion} h` : "—"}
                hint="Reporte → resolución."
                delay={0.1}
              />
              <StatCard
                icon={TriangleAlert}
                label="Activos fuera de SLA"
                value={sla.activosVencidos}
                hint={`${sla.activosEnRiesgo} en riesgo · ${sla.activosSinSla} sin SLA`}
                tono={sla.activosVencidos > 0 ? "peligro" : "neutral"}
                delay={0.15}
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <AlarmClock className="size-3.5" aria-hidden />
                Cumplimiento de resolución: {sla.resolucionCumplidas} cumplidas ·{" "}
                {sla.resolucionVencidas} vencidas
              </span>
              <span>
                Respuesta: {sla.respuestaCumplidas} cumplidas · {sla.respuestaVencidas} vencidas
              </span>
              <span>
                {sla.conSla} incidencias con SLA · {sla.sinSla} sin acuerdo aplicable
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Desglose por estado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidencias por estado</CardTitle>
            <CardDescription>Conteo simple del total registrado (sin series temporales).</CardDescription>
          </CardHeader>
          <CardContent>
            {porEstado.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Sin incidencias todavía"
                description="Cuando se registren incidencias verás su distribución por estado."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {porEstado.map((s) => (
                  <li key={s.nombre} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm">{s.nombre}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.round((s.cantidad / maxEstado) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums">{s.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Desglose por tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidencias por tipo</CardTitle>
            <CardDescription>Los tipos más frecuentes primero.</CardDescription>
          </CardHeader>
          <CardContent>
            {porTipo.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Sin datos todavía"
                description="La distribución por tipo aparecerá con los primeros reportes."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {porTipo.slice(0, 6).map((s) => (
                  <li key={s.nombre} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm">{s.nombre}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/50"
                        style={{ width: `${Math.round((s.cantidad / maxTipo) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums">{s.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas incidencias */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Últimas incidencias</CardTitle>
            <Link href="/admin/incidencias" className="text-sm font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <CardDescription>Los reportes más recientes del sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {ultimas.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin incidencias registradas"
              description="Aún no hay reportes. El flujo comienza cuando alguien escanea un QR."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {ultimas.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/seguimiento?codigo=${encodeURIComponent(i.codigo)}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                  >
                    <span className="font-mono text-xs font-semibold">{i.codigo}</span>
                    <span className="min-w-0 flex-1 truncate">{i.ambiente} — {i.descripcion}</span>
                    <span className="text-xs text-muted-foreground">{fechaHora(i.fecha_reporte)}</span>
                    <PriorityBadge prioridad={i.prioridad} />
                    <StatusBadge estado={i.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Accesos a módulos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gestión</CardTitle>
          <CardDescription>Acceso directo a los módulos administrativos de esta fase.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modulos.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-4 transition-colors hover:bg-accent/40"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <m.icon className="size-4 text-primary" aria-hidden />
                  {m.label}
                </span>
                <span className="text-xs text-muted-foreground">{m.nota}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
