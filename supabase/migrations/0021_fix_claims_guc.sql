-- ============================================================================
-- SIR-UPSJB · 0021_fix_claims_guc.sql
-- FIX CRÍTICO: las funciones de sesión leían el GUC singular
-- `request.jwt.claim.sub` que PostgREST moderno NO repuebla (solo existe
-- `request.jwt.claims` con el JWT completo). Resultado: usuario_actual() =
-- NULL → toda policy con id = usuario_actual() devolvía 0 filas →
-- "Perfil no disponible en este momento".
--
-- Solución: leer PRIMERO request.jwt.claims (JSON completo, formato actual de
-- PostgREST) con fallback al GUC singular (compatibilidad si la plataforma
-- revive el formato antiguo). Aplica a:
--   · usuario_actual()      → sub del JWT
--   · tiene_rol(text)       → claim roles del JWT + fallback BD
--   · roles_actuales()      → claim roles + fallback BD (redefine 0010/0020)
-- Idempotente · ejecutar como postgres.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) usuario_actual(): sub del JWT — 2 rutas: claims JSON → GUC singular
-- ----------------------------------------------------------------------------
create or replace function public.usuario_actual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
$$;

comment on function public.usuario_actual() is
  'UUID del usuario del JWT: claim sub desde request.jwt.claims (PostgREST actual) o el GUC singular si existiese. Fix 0021.';

-- ----------------------------------------------------------------------------
-- 2) tiene_rol(rol): claim `roles` del JWT; sin claim → usuarios_roles (BD)
-- ----------------------------------------------------------------------------
create or replace function public.tiene_rol(p_rol text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim text;
  v_roles text[];
begin
  -- Claim `roles` del JWT (claims JSON completo o GUC singular).
  v_claim := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'roles',
    nullif(current_setting('request.jwt.claim.roles', true), '')
  );
  if v_claim is not null and v_claim <> 'null' then
    begin
      select array(select jsonb_array_elements_text(v_claim::jsonb)) into v_roles;
    exception when others then
      v_roles := '{}';
    end;
  end if;

  -- Fallback (hook inactivo o claim vacío): fuente de verdad en la BD.
  if v_roles is null or array_length(v_roles, 1) is null then
    select array(
      select r.nombre
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.perfil_id = public.usuario_actual()
        and r.activo
    ) into v_roles;
  end if;

  return p_rol = any(v_roles);
end;
$$;

comment on function public.tiene_rol(text) is
  '¿El JWT del usuario tiene el rol dado? claims JSON → GUC singular → fallback usuarios_roles. Fix 0021.';

-- ----------------------------------------------------------------------------
-- 3) roles_actuales(): mismos 3 caminos (reemplaza la versión de 0020)
-- ----------------------------------------------------------------------------
create or replace function public.roles_actuales()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim text;
  v_roles text[];
  v_bd    text[];
begin
  v_claim := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'roles',
    nullif(current_setting('request.jwt.claim.roles', true), '')
  );
  if v_claim is not null and v_claim <> 'null' then
    begin
      select array(select jsonb_array_elements_text(v_claim::jsonb)) into v_roles;
    exception when others then
      v_roles := '{}';
    end;
  end if;

  select array(
    select r.nombre
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    where ur.perfil_id = public.usuario_actual()
      and r.activo
  ) into v_bd;

  return coalesce(
    case when array_length(v_roles, 1) > 0 then v_roles end,
    case when v_bd is not null then v_bd end,
    '{}'::text[]
  );
end;
$$;

comment on function public.roles_actuales() is
  'Roles del JWT: claims JSON → GUC singular → fallback usuarios_roles. Fix 0021.';

-- ----------------------------------------------------------------------------
-- 4) Re-grant (las re-creaciones pierden grants previos)
-- ----------------------------------------------------------------------------
revoke execute on function public.usuario_actual() from public, anon;
grant execute on function public.usuario_actual() to authenticated, public;
revoke execute on function public.tiene_rol(text) from public, anon;
grant execute on function public.tiene_rol(text) to authenticated;
revoke execute on function public.roles_actuales() from public, anon;
grant execute on function public.roles_actuales() to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Verificación: compila y ejecuta las 3 funciones (con JWT postgres: NULL=OK)
-- ----------------------------------------------------------------------------
do $$
begin
  perform public.usuario_actual();
  perform public.tiene_rol('ADMINISTRADOR');
  perform public.roles_actuales();
  raise notice 'OK: funciones 0021 creadas (usuario_actual, tiene_rol, roles_actuales)';
end $$;
