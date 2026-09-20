/**
 * REGLAS DE EVIDENCIAS (compartidas cliente/servidor) · SIR-UPSJB
 *
 * Módulo ISLETO sin dependencias de servidor (sin next/headers, sin supabase):
 * puede importarse desde componentes cliente y desde Server Actions.
 *
 * La fuente de autoridad de estas reglas es la BD:
 *   · MIME y tamaño: allowed_mime_types + file_size_limit del bucket
 *     `evidencias` (0009) y la RPC `adjuntar_evidencia` (0013) revalida.
 *   · Tipos de evidencia: CHECK ck_incidencia_adjuntos_tipo (0001).
 * En el cliente solo sirven para retroalimentación temprana (UX); la
 * validación real ocurre SIEMPRE en servidor.
 */

/** MIME aceptados por el bucket `evidencias` (0009). */
export const EVIDENCIA_MIME_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
] as const;

/** Tamaño máximo por archivo: 10 MB (file_size_limit del bucket, 0009). */
export const EVIDENCIA_TAMANO_MAX = 10 * 1024 * 1024;

/** Tipos de evidencia (CHECK de BD). */
export const EVIDENCIA_TIPOS = [
  "antes",
  "durante",
  "despues",
  "documento",
  "video",
] as const;

export type EvidenciaTipo = (typeof EVIDENCIA_TIPOS)[number];

/** Extensión segura derivada del MIME validado (nunca del nombre original). */
export function extensionDeMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    case "video/mp4":
      return "mp4";
    default:
      return "bin";
  }
}

/**
 * Deriva el tipo de evidencia del MIME real validado: PDF → documento,
 * MP4 → video, imágenes → antes (el técnico puede reclasificar después).
 */
export function tipoEvidenciaDeMime(mime: string): EvidenciaTipo {
  if (mime === "application/pdf") return "documento";
  if (mime === "video/mp4") return "video";
  return "antes";
}
