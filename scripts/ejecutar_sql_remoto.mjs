/**
 * Ejecuta un archivo .sql contra el proyecto Supabase usando la Management API.
 *
 * Uso:
 *   SUPABASE_TOKEN=sbp_xxx node scripts/ejecutar_sql_remoto.mjs <ruta/al/archivo.sql> [proyecto_ref]
 *
 * El token se pasa por variable de entorno (nunca se guarda en archivos).
 */
import { readFileSync } from "node:fs";

const [, , archivo, refArg] = process.argv;
const token = process.env.SUPABASE_TOKEN;
const ref = refArg ?? "uwagkptyvwdhpesphcxk";

if (!archivo) {
  console.error("Uso: node scripts/ejecutar_sql_remoto.mjs <archivo.sql> [proyecto_ref]");
  process.exit(1);
}
if (!token) {
  console.error("Falta SUPABASE_TOKEN en el entorno.");
  process.exit(1);
}

const sql = readFileSync(archivo, "utf8");
const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const texto = await res.text();
console.log(`HTTP ${res.status}`);

// La API puede responder con resultados, errores, o NOTICEs de Postgres.
try {
  const json = JSON.parse(texto);
  console.log(JSON.stringify(json, null, 2).slice(0, 8000));
} catch {
  console.log(texto.slice(0, 8000));
}

if (!res.ok) process.exit(2);
