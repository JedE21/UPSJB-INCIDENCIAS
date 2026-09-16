import { NextResponse, type NextRequest } from "next/server";
import { qrPng, urlDeQr } from "@/lib/qr/qr";

/**
 * GET /api/qr/[codigo]/png — imagen PNG del QR (descarga/impresión).
 * El PNG se genera en servidor con la librería encapsulada en lib/qr/qr.ts;
 * el contenido es la URL estable /r/<codigo>. Cacheable 1 año (el contenido
 * de un código nunca cambia; si se rota, cambia el código).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo: codigoParam } = await params;
  const codigo = decodeURIComponent(codigoParam).trim().toUpperCase();

  const CODIGO_REGEX = /^([A-Z0-9]+-)+[0-9]{4}$/;
  if (!CODIGO_REGEX.test(codigo)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  // Origen absoluto: prioriza dominio desplegado; fallback al host de la petición.
  const origen =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${_request.nextUrl.protocol}//${_request.nextUrl.host}`;

  const png = await qrPng(`${origen}${urlDeQr(codigo)}`);

  return new NextResponse(png as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${codigo}.png"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
