/**
 * GENERACIÓN DE CÓDIGOS QR · SIR-UPSJB (módulo QR)
 *
 * Encapsula la librería `qrcode`: ningún otro módulo del proyecto la importa
 * directamente. El contenido del QR es la URL estable /r/<codigo> (D6 del
 * diseño de BD): cambiar de dominio no obliga a reimprimir los códigos.
 */

import QRCode from "qrcode";

/** Prefijo fijo de la ruta de destino (url_destino del esquema). */
export const PREFIJO_RUTA_QR = "/r/";

/** URL pública que codifica el QR (ruta estable de la app). */
export function urlDeQr(codigo: string): string {
  return `${PREFIJO_RUTA_QR}${encodeURIComponent(codigo)}`;
}

/** Contenido absoluto que se imprime dentro del QR (origen + /r/<codigo>). */
export function contenidoQr(codigo: string, origen: string): string {
  return `${origen.replace(/\/$/, "")}${urlDeQr(codigo)}`;
}

/** Data URL PNG (para <img> en la vista previa del panel). */
export async function qrDataUrl(contenido: string): Promise<string> {
  return QRCode.toDataURL(contenido, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}

/** PNG como Uint8Array (para descarga e impresión). */
export async function qrPng(contenido: string): Promise<Uint8Array> {
  return QRCode.toBuffer(contenido, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
