/**
 * DATOS DE EJEMPLO ETIQUETADOS · SIR-UPSJB
 *
 * ⚠️  DATOS DEMO — NO son de la base de datos.
 *
 * Los datos reales de incidencias/notificaciones se leen desde Supabase cuando
 * se implemente la lógica (Fase 6). Estos arreglos alimentan SOLO la maqueta
 * visual de esta etapa. Cada componente que los muestre debe renderizar el
 * aviso `AvisoDemo` (components/shared/aviso-demo.tsx).
 */

import type { EstadoIncidencia } from "@/lib/incidencias-visual";

/** Incidencia de ejemplo para maquetas (estructura alineada a `incidencias`). */
export interface IncidenciaDemo {
  codigo: string;
  estado: EstadoIncidencia;
  tipo: string;
  subtipo: string;
  ambiente: string;
  fechaReporte: string;
  /** Descripción corta del reporte. */
  resumen: string;
}

/** Notificación de ejemplo para maquetas (estructura alineada a `notificaciones`). */
export interface NotificacionDemo {
  id: number;
  titulo: string;
  cuerpo: string;
  /** Fecha ISO de creación. */
  fecha: string;
  /** true = sin marcar como leída. */
  noLeida?: boolean;
  /** Código de incidencia relacionada, si aplica. */
  codigoIncidencia?: string;
}

export const INCIDENCIAS_EJEMPLO: readonly IncidenciaDemo[] = [
  {
    codigo: "INC-2026-00128",
    estado: "Pendiente",
    tipo: "Técnica",
    subtipo: "Computadora no enciende",
    ambiente: "Aula B-104",
    fechaReporte: "2026-09-14T10:30:00-05:00",
    resumen: "La computadora del escritorio del docente no enciende al presionar el botón.",
  },
  {
    codigo: "INC-2026-00121",
    estado: "En proceso",
    tipo: "Conectividad",
    subtipo: "WiFi intermitente",
    ambiente: "Laboratorio C-201",
    fechaReporte: "2026-09-12T08:15:00-05:00",
    resumen: "El WiFi se desconecta cada pocos minutos en la mitad trasera del laboratorio.",
  },
  {
    codigo: "INC-2026-00119",
    estado: "Resuelta",
    tipo: "Mobiliario",
    subtipo: "Silla dañada",
    ambiente: "Aula A-302",
    fechaReporte: "2026-09-08T16:45:00-05:00",
    resumen: "Dos sillas de la última fila tienen una pata rota.",
  },
  {
    codigo: "INC-2026-00112",
    estado: "Cerrada",
    tipo: "Infraestructura",
    subtipo: "Luminaria fundida",
    ambiente: "Pasillo Pabellón B",
    fechaReporte: "2026-09-02T09:20:00-05:00",
    resumen: "Una luminaria del pasillo del segundo piso está fundida.",
  },
];

/** Historial de ejemplo alineado a `incidencia_historial`. */
export const HISTORIAL_EJEMPLO: readonly { titulo: string; descripcion: string; fecha: string }[] = [
  {
    titulo: "Reportada",
    descripcion: "El usuario registró la incidencia desde el QR del ambiente.",
    fecha: "2026-09-14T10:30:00-05:00",
  },
  {
    titulo: "Asignada",
    descripcion: "Asignada al área de Soporte Técnico.",
    fecha: "2026-09-14T11:05:00-05:00",
  },
  {
    titulo: "En proceso",
    descripcion: "El técnico está revisando el equipo.",
    fecha: "2026-09-14T15:40:00-05:00",
  },
];

export const NOTIFICACIONES_EJEMPLO: readonly NotificacionDemo[] = [
  {
    id: 3,
    titulo: "Incidencia INC-2026-00128 asignada",
    cuerpo: "Tu reporte en Aula B-104 fue asignado a un técnico de Soporte Técnico.",
    fecha: "2026-09-14T11:05:00-05:00",
    noLeida: true,
    codigoIncidencia: "INC-2026-00128",
  },
  {
    id: 2,
    titulo: "Incidencia INC-2026-00121 en proceso",
    cuerpo: "La incidencia INC-2026-00121 está siendo atendida por el técnico.",
    fecha: "2026-09-13T09:10:00-05:00",
    noLeida: true,
    codigoIncidencia: "INC-2026-00121",
  },
  {
    id: 1,
    titulo: "Incidencia INC-2026-00119 resuelta",
    cuerpo: "La incidencia INC-2026-00119 fue resuelta. Puedes confirmar si quedó conforme.",
    fecha: "2026-09-09T14:30:00-05:00",
    codigoIncidencia: "INC-2026-00119",
  },
];
