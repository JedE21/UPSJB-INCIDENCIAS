/**
 * Utilidades de fecha · SIR-UPSJB
 * Formato es-PE (Lima). Los timestamps llegan como texto ISO desde Supabase.
 */

/** Página TZ fija (Perú, UTC-5, sin horario de verano). */
const TZ = "America/Lima";

/** Fecha y hora: "15/09/2026, 21:42". */
export function fechaHora(valor: string | Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));
}

/** Solo fecha: "15/09/2026". */
export function fechaCorta(valor: string | Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(valor));
}

/** Solo hora: "21:42". */
export function horaCorta(valor: string | Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(valor));
}
