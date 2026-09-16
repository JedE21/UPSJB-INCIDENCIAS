import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Palette,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatCard } from "@/components/shared/stat-card";
import { Timeline } from "@/components/shared/timeline";
import { StatusBadge, PriorityBadge } from "@/components/incidencias/badges";
import { ProgresoEstado } from "@/components/incidencias/progreso-estado";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DemoInteractiva } from "./demo-interactiva";

export const metadata: Metadata = { title: "Catálogo UI" };

/**
 * CATÁLOGO UI · página de referencia de la base visual (Fase 12 — UX/UI).
 * Muestra los componentes reutilizables sobre los que se construirán los
 * módulos siguientes (QR, incidencias, dashboards…). Sin lógica de negocio.
 * Los datos mostrados son de ejemplo EN MEMORIA para esta página de prueba;
 * no se inserta nada en la base de datos.
 */

const ESTADOS = [
  "Pendiente",
  "Asignada",
  "En proceso",
  "En espera",
  "Resuelta",
  "Cerrada",
  "Cancelada",
] as const;

const PRIORIDADES = ["Baja", "Media", "Alta", "Crítica"] as const;

export default function CatalogoUiPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/admin" },
            { label: "Catálogo UI" },
          ]}
        />
        <PageHeader
          icon={Palette}
          title="Catálogo UI"
          description="Componentes reutilizables de la base visual de SIR-UPSJB. Referencia para construir los módulos de las siguientes fases."
        />
      </div>

      {/* Estados (§50: texto + icono, no solo color) */}
      <Card>
        <CardHeader>
          <CardTitle>Estados de incidencia</CardTitle>
          <CardDescription>
            Icono + texto + matiz de color (semilla 0005). Nunca solo color.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((estado) => (
              <StatusBadge key={estado} estado={estado} />
            ))}
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Progreso de flujo (ejemplo: en proceso)
            </p>
            <ProgresoEstado estado="En proceso" />
          </div>
        </CardContent>
      </Card>

      {/* Prioridades */}
      <Card>
        <CardHeader>
          <CardTitle>Prioridades</CardTitle>
          <CardDescription>Niveles 1–4 de la tabla prioridades.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRIORIDADES.map((prioridad) => (
            <PriorityBadge key={prioridad} prioridad={prioridad} />
          ))}
        </CardContent>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
          <CardDescription>
            Mensajes informativos con icono por tipo (info, éxito, advertencia, error).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Alert variant="info">
            <AlertTitle>Incidencia asignada</AlertTitle>
            <AlertDescription>
              El técnico asignado fue notificado para iniciar la atención.
            </AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>Incidencia resuelta</AlertTitle>
            <AlertDescription>
              Queda pendiente tu confirmación para cerrar el reporte.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Tiempo de atención por vencer</AlertTitle>
            <AlertDescription>
              La incidencia está próxima a exceder el tiempo objetivo definido.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Error al guardar</AlertTitle>
            <AlertDescription>
              No se pudo actualizar la incidencia. Intenta nuevamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Indicadores (dashboards §31/§34) */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Indicadores para dashboards
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={ClipboardList} label="Incidencias totales" value="—" hint="Demo · sin datos" />
          <StatCard icon={Wrench} label="En proceso" value="—" hint="Demo · sin datos" delay={0.05} />
          <StatCard icon={CheckCircle2} label="Resueltas" value="—" hint="Demo · sin datos" delay={0.1} />
          <StatCard icon={CalendarClock} label="Fuera de SLA" value="—" hint="Demo · sin datos" delay={0.15} />
        </div>
      </div>

      {/* Timeline y estados */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Timeline de seguimiento</CardTitle>
            <CardDescription>
              Historial detallado de una incidencia (concepto §30).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline
              hitos={[
                {
                  title: "Reportada",
                  description: "La incidencia fue registrada mediante código QR.",
                  icon: CheckCircle2,
                  estado: "done",
                },
                {
                  title: "Asignada",
                  description: "Asignada al área de Sistemas.",
                  icon: Wrench,
                  estado: "current",
                },
                {
                  title: "Resuelta",
                  description: "Pendiente de atención.",
                  estado: "pending",
                },
                {
                  title: "Cerrada",
                  estado: "pending",
                },
              ]}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Estado vacío</CardTitle>
              <CardDescription>Cuando no hay datos que mostrar.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={AlertTriangle}
                title="Sin incidencias"
                description="Cuando registres incidencias aparecerán aquí."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estado de carga</CardTitle>
              <CardDescription>Mientras se obtienen datos.</CardDescription>
            </CardHeader>
            <CardContent>
              <LoadingState message="Cargando incidencias…" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Interacción, formularios, tabla y adjuntos (cliente) */}
      <DemoInteractiva />
    </div>
  );
}
