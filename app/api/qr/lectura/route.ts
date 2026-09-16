import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth/session";

/**
 * POST /api/qr/lectura — registro de lecturas (lecturas_qr, §14.2).
 *
 * Seguridad:
 *  · Solo acepta { codigo }: el perfil se resuelve EN SERVIDOR desde la
 *    sesión (nunca desde el cuerpo); dispositivo/navegador se derivan del
 *    User-Agent real de la petición.
 *  · Inserta vía RPC SECURITY DEFINER (0011): el rol anónimo no necesita
 *    grants sobre lecturas_qr.
 *  · Código validado contra el CHECK de BD por la propia RPC.
 */

const CODIGO_REGEX = /^([A-Z0-9]+-)+[0-9]{4}$/;

/** Clasificación mínima del User-Agent (sin dependencias). */
function clasificarAgente(ua: string): { dispositivo: string; navegador: string } {
  const esMovil = /Mobi|Android|iPhone|iPad/i.test(ua);
  let navegador = "Otro";
  if (/Edg\//i.test(ua)) navegador = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) navegador = "Opera";
  else if (/Chrome\//i.test(ua)) navegador = "Chrome";
  else if (/Safari\//i.test(ua)) navegador = "Safari";
  else if (/Firefox\//i.test(ua)) navegador = "Firefox";

  return {
    dispositivo: esMovil ? "Móvil" : "Escritorio",
    navegador,
  };
}

export async function POST(request: NextRequest) {
  let codigo = "";
  try {
    const cuerpo = (await request.json()) as { codigo?: unknown };
    if (typeof cuerpo.codigo === "string") codigo = cuerpo.codigo.trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!CODIGO_REGEX.test(codigo)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const sesion = await getSesion();
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const { dispositivo, navegador } = clasificarAgente(ua);

  const { error } = await supabase.rpc("registrar_lectura_qr", {
    p_codigo: codigo,
    p_dispositivo: dispositivo,
    p_navegador: navegador,
  });

  if (error) {
    return NextResponse.json({ error: "No se pudo registrar la lectura." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, autenticado: Boolean(sesion) });
}
