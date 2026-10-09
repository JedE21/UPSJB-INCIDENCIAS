// ============================================================================
// SIR-UPSJB · Edge Function "crear-usuario"
// ÚNICO punto privilegiado del sistema: el panel ADMIN la invoca (con el JWT
// de un administrador autenticado) para crear cuentas en Supabase Auth y su
// perfil 1:1 + rol, replicando lo que hace asignar_admin_jose.sql.
//
// SEGURIDAD:
//   · La service_role vive SOLO como secret de esta función (Supabase →
//     Edge Function Secrets), nunca en Vercel ni en el bundle del frontend.
//   · Verifica el JWT del llamante (Authorization: Bearer <access_token>)
//     contra Supabase Auth y exige rol ADMINISTRADOR en usuarios_roles.
//   · Idempotente si el correo ya existe: informa sin duplicar.
//
// ENTRADA (JSON):
//   { correo, contrasena, nombres, apellidoPaterno, apellidoMaterno?,
//     documento?, telefono?, rol: "ADMINISTRADOR"|"TECNICO"|"COORDINADOR"|"USUARIO" }
// SALIDA:
//   201 { ok: true, usuario_id, correo, rol } | 4xx/5xx { ok: false, error }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Cuerpo {
  correo?: string;
  contrasena?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  documento?: string;
  telefono?: string;
  rol?: string;
}

const ROLES_VALIDOS = new Set(["ADMINISTRADOR", "COORDINADOR", "TECNICO", "USUARIO"]);
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Administra la BD con service_role (secret de la función) y verifica al
// llamante con su propio JWT.
function clientes(req: Request) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  const admin = createClient(SUPABASE_URL, SR, { auth: { autoRefreshToken: false, persistSession: false } });
  const llamante = createClient(SUPABASE_URL, SR, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  return { admin, jwt };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method !== "POST") return json(405, { ok: false, error: "Método no permitido." });

  // ------------------------------------------------------------------
  // 1) Verificar al llamante: sesión real + rol ADMINISTRADOR (fuente de
  //    verdad: usuarios_roles, igual que la guardia del panel).
  // ------------------------------------------------------------------
  const { admin, jwt } = clientes(req);
  if (!jwt) return json(401, { ok: false, error: "Se requiere el token de sesión del administrador." });

  const { data: userinfo, error: errorUser } = await admin.auth.getUser(jwt);
  if (errorUser || !userinfo?.user) {
    return json(401, { ok: false, error: "Sesión inválida o expirada." });
  }
  const uidAdmin = userinfo.user.id;

  const { data: filasRol, error: errorRol } = await admin
    .from("usuarios_roles")
    .select("rol_id")
    .eq("perfil_id", uidAdmin);

  if (errorRol) return json(500, { ok: false, error: "No se pudo verificar tu rol." });

  // Verificar que el rol ADMINISTRADOR esté presente y activo para el llamante.
  let esAdmin = false;
  if (filasRol && filasRol.length > 0) {
    const ids = filasRol.map((f: { rol_id: string }) => f.rol_id);
    const { data: roles, error: errorRoles } = await admin
      .from("roles")
      .select("id, nombre, activo")
      .in("id", ids);
    if (errorRoles) return json(500, { ok: false, error: "No se pudo verificar tu rol." });
    esAdmin = (roles ?? []).some((r: { nombre: string; activo: boolean }) => r.nombre === "ADMINISTRADOR" && r.activo);
  }
  if (!esAdmin) {
    return json(403, { ok: false, error: "Solo el ADMINISTRADOR puede crear usuarios." });
  }

  // ------------------------------------------------------------------
  // 2) Validar entrada.
  // ------------------------------------------------------------------
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await req.json()) as Cuerpo;
  } catch {
    return json(400, { ok: false, error: "JSON inválido." });
  }

  const correo = (cuerpo.correo ?? "").trim().toLowerCase();
  const contrasena = cuerpo.contrasena ?? "";
  const nombres = (cuerpo.nombres ?? "").trim();
  const apellidoPaterno = (cuerpo.apellidoPaterno ?? "").trim();
  const apellidoMaterno = (cuerpo.apellidoMaterno ?? "").trim() || null;
  const documento = (cuerpo.documento ?? "").trim() || null;
  const telefono = (cuerpo.telefono ?? "").trim() || null;
  const rol = (cuerpo.rol ?? "").trim().toUpperCase();

  if (!RE_EMAIL.test(correo)) return json(400, { ok: false, error: "Correo no válido." });
  if (contrasena.length < 8) return json(400, { ok: false, error: "La contraseña debe tener al menos 8 caracteres." });
  if (!nombres) return json(400, { ok: false, error: "El nombre es obligatorio." });
  if (!apellidoPaterno) return json(400, { ok: false, error: "El apellido paterno es obligatorio." });
  if (!ROLES_VALIDOS.has(rol)) return json(400, { ok: false, error: "Rol no válido." });

  // Idempotencia amable: si el correo ya existe, se informa sin duplicar.
  const { data: porCorreo, error: errorLookup } = await admin.auth.admin.listUsers();
  const existente = errorLookup
    ? null
    : (porCorreo.users.find((u) => (u.email ?? "").toLowerCase() === correo) ?? null);

  if (existente) {
    return json(409, { ok: false, error: `Ya existe una cuenta con el correo ${correo}.` });
  }

  // ------------------------------------------------------------------
  // 3) Crear en Auth (admin.createUser) → perfil → rol → sync del JWT.
  // ------------------------------------------------------------------
  const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true, // cuenta lista para usar; el panel informa la contraseña al admin
    user_metadata: { nombres, apellido_paterno: apellidoPaterno },
  });
  if (errorCrear || !creado?.user) {
    return json(500, { ok: false, error: `No se pudo crear la cuenta en Auth: ${errorCrear?.message ?? "desconocido"}` });
  }
  const nuevoId = creado.user.id;

  // El trigger on_auth_user_created (register_new_user) YA inserta el perfil
  // al crear el usuario en Auth. Aquí se COMPLETA con los datos del formulario:
  // si el trigger no corrió (creación manual), se inserta; si ya está, se actualiza.
  const { error: errorPerfil } = await admin.from("perfiles").upsert({
    id: nuevoId,
    nombres,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    documento,
    telefono,
    correo,
    estado: "activo",
  }, { onConflict: "id" });
  if (errorPerfil) {
    // Rollback manual: intentar no dejar huérfano en Auth.
    await admin.auth.admin.deleteUser(nuevoId);
    return json(500, { ok: false, error: `Perfil no creado: ${errorPerfil.message}` });
  }

  const { data: filaRol, error: errorBuscarRol } = await admin
    .from("roles")
    .select("id, activo")
    .eq("nombre", rol)
    .maybeSingle();
  if (errorBuscarRol || !filaRol) {
    await admin.auth.admin.deleteUser(nuevoId);
    return json(500, { ok: false, error: `No existe el rol ${rol}.` });
  }
  if (!filaRol.activo) {
    await admin.auth.admin.deleteUser(nuevoId);
    return json(500, { ok: false, error: `El rol ${rol} está desactivado.` });
  }

  const { error: errorUR } = await admin
    .from("usuarios_roles")
    .upsert({ perfil_id: nuevoId, rol_id: filaRol.id, asignado_por: uidAdmin }, { onConflict: "perfil_id,rol_id" });
  if (errorUR) {
    await admin.auth.admin.deleteUser(nuevoId);
    return json(500, { ok: false, error: `No se pudo asignar el rol: ${errorUR.message}` });
  }

  await admin.rpc("sincronizar_roles_auth", { p_usuario: nuevoId });

  return json(201, { ok: true, usuario_id: nuevoId, correo, rol });
});
