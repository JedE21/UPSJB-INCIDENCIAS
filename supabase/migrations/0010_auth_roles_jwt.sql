-- ============================================================================
-- SIR-UPSJB · 0010_auth_roles_jwt.sql
-- FASE 3 · Autenticación: roles en el JWT (Supabase Auth ↔ perfiles/roles).
--
-- Qué resuelve:
--   · Las funciones RLS de 0006 (roles_actuales → tiene_rol / tiene_permiso)
--     leen los roles desde el claim `roles` del JWT
--     (GUC request.jwt.claim.roles). Este script provee el mecanismo para que
--     ese claim exista y esté siempre sincronizado con la BD.
--   · Fuente de verdad de los roles: public.usuarios_roles (asignación vigente).
--   · El claim lo escribe Supabase Auth vía Custom Access Token Hook; el
--     cliente NUNCA puede modificarlo (los claims del JWT solo los emite el
--     servidor de Auth) → no falsificable.
--
-- Contenido:
--   1. custom_access_token_hook(event)  → inyecta claims.roles al emitir el JWT
--      (login, refresh, etc.). Ordena los roles por jerarquía: el rol principal
--      queda primero (coherente con public.roles_actuales()[1] y con la
--      redirección por panel de la app).
--   2. sincronizar_roles_auth(usuario)  → RPC: recalcula los roles desde
--      usuarios_roles y los persiste en auth.users.raw_app_meta_data.roles.
--      Úsala cuando el ADMINISTRADOR cambia roles de un usuario con sesión
--      activa, seguida de supabase.auth.refreshSession() en el cliente.
--
-- CONFIGURACIÓN EN EL DASHBOARD (no versionable en SQL — REQUERIDO):
--   Authentication → Hooks → "Customize Access Token (Auth Hooks)" →
--   seleccionar la función public.custom_access_token_hook → Save.
--   Sin este paso los JWT no llevan el claim `roles` y las políticas RLS
--   basadas en tiene_rol() denegarán el acceso (el login sí funcionará).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Custom Access Token Hook: inyecta los roles vigentes en los claims del JWT
--    Firma y contrato exigidos por Supabase Auth (event jsonb → event jsonb).
--    SECURITY DEFINER: corre como owner al emitir el token (antes de existir
--    sesión); solo lo invoca supabase_auth_admin.
-- ----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_roles text[];
begin
  select coalesce(array_agg(r.nombre order by
             case r.nombre
               when 'ADMINISTRADOR'  then 1
               when 'COORDINADOR'    then 2
               when 'SUPERVISOR'     then 3
               when 'TECNICO'        then 4
               when 'DOCENTE'        then 5
               when 'ADMINISTRATIVO' then 6
               when 'ESTUDIANTE'     then 7
               else 8
             end, r.nombre), '{}')
    into v_roles
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
   where ur.perfil_id = (event ->> 'user_id')::uuid
     and r.activo;

  event := jsonb_set(
    event,
    '{claims,roles}',
    to_jsonb(coalesce(v_roles, '{}'::text[]))
  );

  return event;
exception
  when others then
    -- Nunca romper la emisión de tokens: si la lectura de roles falla,
    -- el JWT sale sin el claim y RLS deniega (fallo seguro, no abierto).
    return event;
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

comment on function public.custom_access_token_hook(jsonb) is
  'FASE 3: inyecta claims.roles (roles activos de usuarios_roles) en el JWT. Configurar como Custom Access Token Hook en el Dashboard de Supabase Auth.';

-- ----------------------------------------------------------------------------
-- 2. RPC de sincronización: recalcula roles desde la BD y los persiste en
--    auth.users.raw_app_meta_data.roles (solo el servidor puede escribirlo).
--    · El propio usuario puede sincronizar sus roles (no escala: la BD decide).
--    · El ADMINISTRADOR puede sincronizar a cualquiera.
--    · Sin JWT (postgres/service_role, p. ej. desde el panel): permitido.
-- ----------------------------------------------------------------------------
create or replace function public.sincronizar_roles_auth(p_usuario uuid default null)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_usuario, auth.uid());
  v_roles  text[];
  v_meta   jsonb;
begin
  if v_target is null then
    raise exception 'sincronizar_roles_auth: indica el usuario (sesión o parámetro)';
  end if;

  if coalesce(auth.uid()::text, '') not in ('', v_target::text)
     and not coalesce(public.tiene_rol('ADMINISTRADOR'), false) then
    raise exception 'sincronizar_roles_auth: sin permisos para actualizar ese usuario';
  end if;

  select coalesce(array_agg(r.nombre order by
             case r.nombre
               when 'ADMINISTRADOR'  then 1
               when 'COORDINADOR'    then 2
               when 'SUPERVISOR'     then 3
               when 'TECNICO'        then 4
               when 'DOCENTE'        then 5
               when 'ADMINISTRATIVO' then 6
               when 'ESTUDIANTE'     then 7
               else 8
             end, r.nombre), '{}')
    into v_roles
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
   where ur.perfil_id = v_target
     and r.activo;

  select coalesce(raw_app_meta_data, '{}'::jsonb) into v_meta
    from auth.users
   where id = v_target;

  if v_meta is null then
    raise exception 'sincronizar_roles_auth: usuario % no existe en auth.users', v_target;
  end if;

  update auth.users
     set raw_app_meta_data = jsonb_set(v_meta, '{roles}', to_jsonb(v_roles))
   where id = v_target;

  return v_roles;
end;
$$;

revoke execute on function public.sincronizar_roles_auth(uuid) from public, anon;
grant execute on function public.sincronizar_roles_auth(uuid) to authenticated;

comment on function public.sincronizar_roles_auth(uuid) is
  'FASE 3: persiste los roles vigentes en auth.users.raw_app_meta_data.roles. Tras cambios de rol, invocar esta RPC y luego supabase.auth.refreshSession() en la sesión afectada.';

-- ----------------------------------------------------------------------------
-- 3. Verificación: las funciones deben existir.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('custom_access_token_hook', 'sincronizar_roles_auth')
  ) or (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('custom_access_token_hook', 'sincronizar_roles_auth')
  ) <> 2 then
    raise exception 'Faltan funciones de autenticación tras la migración';
  end if;
end
$$;
