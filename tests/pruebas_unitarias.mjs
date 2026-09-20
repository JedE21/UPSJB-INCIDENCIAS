/**
 * PRUEBAS UNITARIAS DE LÓGICA PURA · SIR-UPSJB (Fase 13)
 *
 * Ejecutar: node tests/pruebas_unitarias.mjs
 *
 * Replica exactamente las expresiones/reglas puras de los módulos del
 * proyecto (regex, parseo, formato) para validarlas sin entorno Next ni BD.
 * Cada prueba imprime PASS/FAIL; el script termina con código 1 si hay fallos.
 */

import assert from "node:assert/strict";

let total = 0;
let fallos = 0;

function prueba(nombre, fn) {
  total += 1;
  try {
    fn();
    console.log(`PASS  ${nombre}`);
  } catch (e) {
    fallos += 1;
    console.log(`FAIL  ${nombre}\n      ${e.message}`);
  }
}

/* Regex replicadas de los módulos (fuente: app/r/[codigo]/page.tsx,
   app/(public)/seguimiento, app/admin/reportes/csv, lib/qr). */
// (alias para las pruebas de código de incidencia)
const CODIGO_QR_REGEX = /^([A-Z0-9]+-)+[0-9]{4}$/;
const CODIGO_INC_REGEX = /^INC-\d{4}-\d{4,6}$/;
const RE_INC_CODIGO_SEGUI = CODIGO_INC_REGEX;
const RE_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/* Validación semántica de fechas (corregida en lib/reportes/datos.ts y
   lib/auditoria/constantes.ts: rechaza mes/día imposibles). */
function esFechaValida(t) {
  if (!RE_FECHA.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/* Parseo de filtros de auditoría (lib/auditoria/constantes.ts). */
const ACCIONES_AUDITORIA = [
  "LOGIN", "LOGOUT", "CREAR", "EDITAR", "ASIGNAR", "DERIVAR",
  "CAMBIAR_ESTADO", "ADJUNTAR_EVIDENCIA", "RESOLVER", "CERRAR",
  "MODIFICAR_CONFIGURACION", "ANULAR",
];

function parsearFiltrosAuditoria(sp) {
  const uno = (k) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const texto = (v, max) => {
    const t = (v ?? "").trim();
    return t.length > 0 && t.length <= max ? t : null;
  };
  const fecha = (v) => {
    const t = (v ?? "").trim();
    return esFechaValida(t) ? t : null;
  };
  const pagina = Math.max(1, Math.min(Number(uno("pagina")) || 1, 1000));
  const accion = texto(uno("accion"), 30);
  return {
    accion:
      accion && ACCIONES_AUDITORIA.includes(accion) ? accion : null,
    tabla: texto(uno("tabla"), 63),
    busqueda: texto(uno("q"), 100),
    desde: fecha(uno("desde")),
    hasta: fecha(uno("hasta")),
    pagina,
  };
}

/* destinoSeguro de lib/auth/actions.ts (anti open-redirect). */
function destinoSeguro(valor) {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/") || valor.startsWith("//")) return null;
  return valor;
}

/* Escapado CSV de app/admin/reportes/csv/route.ts (anti formula injection). */
function celda(v) {
  const s = v === null ? "" : String(v);
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/* extensionDeMime de lib/incidencias/evidencias.ts. */
function extensionDeMime(mime) {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "application/pdf": return "pdf";
    case "video/mp4": return "mp4";
    default: return "bin";
  }
}

/* Tamaños legibles de lib/incidencias/formato.ts. */
function tamanoLegible(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* horasLegible de lib/incidencias/sla-formato.ts. */
function horasLegibles(horas) {
  if (horas === null || horas === undefined) return "—";
  return `${Number.isInteger(horas) ? horas : horas.toFixed(1)} h`;
}

/* ============================================================================
   1. CÓDIGOS QR (flujo crítico: escaneo)
   ========================================================================== */

prueba("QR válido institucional (SEDE-PAB-AMB-0001)", () => {
  assert.ok(CODIGO_QR_REGEX.test("FLO-PA1-P101-0001"));
});

prueba("QR con un solo segmento + número (A-0001) es válido", () => {
  assert.ok(CODIGO_QR_REGEX.test("A-0001"));
});

prueba("QR inexistente en formato: letras sin número de 4 dígitos → rechazado", () => {
  assert.ok(!CODIGO_QR_REGEX.test("SEDE-PAB-AMB"));
});

prueba("QR con minúsculas → rechazado (se normaliza a mayúsculas antes)", () => {
  assert.ok(!CODIGO_QR_REGEX.test("sede-pab-0001"));
});

prueba("QR con caracteres de inyección → rechazado", () => {
  assert.ok(!CODIGO_QR_REGEX.test("ABC-0001%20DROP"));
  assert.ok(!CODIGO_QR_REGEX.test("../../etc"));
});

prueba("QR vacío → rechazado", () => {
  assert.ok(!CODIGO_QR_REGEX.test(""));
});

/* ============================================================================
   2. CÓDIGO DE INCIDENCIA (seguimiento)
   ========================================================================== */

prueba("Código INC válido (INC-2026-000128)", () => {
  assert.ok(RE_INC_CODIGO_SEGUI.test("INC-2026-000128"));
});

prueba("Código INC con 4 dígitos válido", () => {
  assert.ok(RE_INC_CODIGO_SEGUI.test("INC-2026-0001"));
});

prueba("Código INC con 7 dígitos → rechazado", () => {
  assert.ok(!RE_INC_CODIGO_SEGUI.test("INC-2026-0001280"));
});

prueba("Código INC con 3 dígitos → rechazado", () => {
  assert.ok(!RE_INC_CODIGO_SEGUI.test("INC-2026-001"));
});

prueba("Código INC con año de 2 dígitos → rechazado", () => {
  assert.ok(!RE_INC_CODIGO_SEGUI.test("INC-26-000128"));
});

prueba("IDOR por código: ids manipulados ('1=1', SQL) no pasan el regex", () => {
  assert.ok(!RE_INC_CODIGO_SEGUI.test("1=1"));
  assert.ok(!RE_INC_CODIGO_SEGUI.test("INC-2026-000128' OR '1'='1"));
});

/* ============================================================================
   3. UUIDs (anti-IDOR en ids de entidades)
   ========================================================================== */

prueba("UUID v4 válido aceptado", () => {
  assert.ok(RE_UUID.test("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"));
});

prueba("ID manipulado (texto) rechazado", () => {
  assert.ok(!RE_UUID.test("otra-incidencia"));
  assert.ok(!RE_UUID.test("00000000-0000-0000-0000-000000000000'"));
});

prueba("UUID con longitud incorrecta rechazado", () => {
  assert.ok(!RE_UUID.test("9b1deb4d-3b7d-4bad-9bdd"));
});

/* ============================================================================
   4. FILTROS DE AUDITORÍA (validación de entrada)
   ========================================================================== */

prueba("Filtros válidos se conservan", () => {
  const f = parsearFiltrosAuditoria({
    accion: "CREAR", tabla: "incidencias", q: "INC-2026-000128",
    desde: "2026-01-01", hasta: "2026-12-31", pagina: "2",
  });
  assert.equal(f.accion, "CREAR");
  assert.equal(f.tabla, "incidencias");
  assert.equal(f.desde, "2026-01-01");
  assert.equal(f.pagina, 2);
});

prueba("Acción fuera del dominio → null (no llega a la BD)", () => {
  const f = parsearFiltrosAuditoria({ accion: "BORRAR_TODO" });
  assert.equal(f.accion, null);
});

prueba("Fecha malformada → null", () => {
  assert.equal(parsearFiltrosAuditoria({ desde: "31/12/2026" }).desde, null);
  assert.equal(parsearFiltrosAuditoria({ desde: "2026-13-01" }).desde, null);
  assert.equal(parsearFiltrosAuditoria({ desde: "2026-02-30" }).desde, null);
  assert.equal(parsearFiltrosAuditoria({ hasta: "2026-12-31" }).hasta, "2026-12-31");
});

prueba("Página inválida (negativa o texto) → 1", () => {
  assert.equal(parsearFiltrosAuditoria({ pagina: "-3" }).pagina, 1);
  assert.equal(parsearFiltrosAuditoria({ pagina: "abc" }).pagina, 1);
});

prueba("Array en query param usa el primer valor (sin polución)", () => {
  const f = parsearFiltrosAuditoria({ accion: ["CREAR", "EDITAR"] });
  assert.equal(f.accion, "CREAR");
});

/* ============================================================================
   5. REDIRECCIONES (anti open-redirect en login)
   ========================================================================== */

prueba("Destino interno relativo aceptado", () => {
  assert.equal(destinoSeguro("/seguimiento?codigo=INC-2026-000128"), "/seguimiento?codigo=INC-2026-000128");
});

prueba("URL absoluta externa → null (open redirect bloqueado)", () => {
  assert.equal(destinoSeguro("https://malicioso.example"), null);
});

prueba("Protocol-relative (//malicioso) → null", () => {
  assert.equal(destinoSeguro("//malicioso.example"), null);
});

prueba("javascript: y esquemas → null", () => {
  assert.equal(destinoSeguro("javascript:alert(1)"), null);
  assert.equal(destinoSeguro("data:text/html;base64,x"), null);
});

/* ============================================================================
   6. EXPORTACIÓN CSV (anti fórmula + escapado)
   ========================================================================== */

prueba("Celda normal se entrecomilla", () => {
  assert.equal(celda("INC-2026-000128"), '"INC-2026-000128"');
});

prueba("Fórmula (=cmd) se neutraliza con apóstrofo", () => {
  assert.equal(celda("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"".replace(/\\"/g, '"'));
});

prueba("Prefijos peligrosos + - @ se neutralizan", () => {
  for (const peligroso of ["=1+1", "+1", "-1", "@cmd"]) {
    const out = celda(peligroso);
    assert.ok(out.startsWith("\"'"), `prefijo neutralizado en ${peligroso}`);
  }
});

prueba("Comillas dobles se duplican (RFC 4180)", () => {
  assert.equal(celda('dijo "hola"'), '"dijo ""hola"""');
});

prueba("null se exporta como vacío", () => {
  assert.equal(celda(null), '""');
});

/* ============================================================================
   7. EVIDENCIAS (extensiones y tamaños)
   ========================================================================== */

prueba("Extensiones por MIME correctas", () => {
  assert.equal(extensionDeMime("image/jpeg"), "jpg");
  assert.equal(extensionDeMime("image/png"), "png");
  assert.equal(extensionDeMime("application/pdf"), "pdf");
  assert.equal(extensionDeMime("video/mp4"), "mp4");
});

prueba("MIME no permitido → bin (y la validación real lo rechaza en servidor)", () => {
  assert.equal(extensionDeMime("application/x-msdownload"), "bin");
});

prueba("Tamaños legibles", () => {
  assert.equal(tamanoLegible(512), "512 B");
  assert.equal(tamanoLegible(2048), "2.0 KB");
  assert.equal(tamanoLegible(5 * 1024 * 1024), "5.0 MB");
  assert.equal(tamanoLegible(-1), "—");
});

/* ============================================================================
   8. SLA · formato de horas (presentación; cálculo real en BD)
   ========================================================================== */

prueba("Horas enteras sin decimales", () => {
  assert.equal(horasLegibles(18), "18 h");
});

prueba("Horas decimales a un decimal", () => {
  assert.equal(horasLegibles(52.0), "52 h");
  assert.equal(horasLegibles(1.55), "1.6 h");
});

prueba("null → guión (sin dato)", () => {
  assert.equal(horasLegibles(null), "—");
  assert.equal(horasLegibles(undefined), "—");
});

/* ============================================================================
   Resumen
   ========================================================================== */

console.log(`\n${total - fallos}/${total} pruebas exitosas`);
process.exit(fallos > 0 ? 1 : 0);
