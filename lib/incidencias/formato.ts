/**
 * FORMATO DE EVIDENCIAS · SIR-UPSJB
 * Utilidades compartidas para mostrar evidencias (tamaños legibles).
 * Las fechas usan lib/fechas (TZ America/Lima).
 */

/** Tamaño legible: "1.2 MB", "345 kB", "8 B". */
export function tamanoLegible(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const unidades = ["B", "kB", "MB", "GB"];
  let valor = bytes;
  let i = 0;
  while (valor >= 1000 && i < unidades.length - 1) {
    valor /= 1000;
    i += 1;
  }
  return `${valor >= 100 || i === 0 ? Math.round(valor) : valor.toFixed(1)} ${unidades[i]}`;
}
