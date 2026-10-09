-- ============================================================================
-- SIR-UPSJB · arreglar_rls_admin.sql
-- CORRECCIÓN: la RLS reconocía el rol SOLO si el JWT llevaba el claim `roles`
-- (Custom Access Token Hook de 0010). Sin hook, soy_administrador()/tiene_rol()
-- devuelven FALSE aunque usuarios_roles tenga el rol → /notificaciones lanza
-- "no tengo acceso" y TODAS las lecturas admin (p_perfiles_admin,
-- p_usuarios_roles_select, etc.) devuelven vacío.
--
-- QUÉ HACE:
--   1. Re-define roles_actuales() con FALLBACK: si el JWT no trae el claim
--      `roles`, lee los roles activos desde public.usuarios_roles (fuente de
--      verdad); si el claim existe, usa el claim (decisión de la BD igual:
--      misma tabla respaldada por sincronizar_roles_auth).
--   2. Garantiza ADMINISTRADOR al usuario joseeche21gd@gmail.com y lo
--      sincroniza hacia auth.users.raw_app_meta_data (por si el hook ya está
--      activo: a partir de esto los JWT nuevos SÍ llevan el claim).
--   3. Verifica si el Custom Access Token Hook está configurado en el
--      proyecto (complete_hook_config de supabase_auth_admin) e instruye.
--   4. Reporte final de verificación.
--
-- CÓMO EJECUTAR: Supabase Dashboard → SQL Editor (rol postgres). Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. roles_actuales() con fallback a la BD (corazón del arreglo)
-- ----------------------------------------------------------------------------
create or replace function public.roles_actuales()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim text[];
  v_bd    text[];
begin
  -- 1º: claim `roles` del JWT (inyectado por el hook, si está configurado)
  begin
    v_claim := array(
      select jsonb_array_elements_text(
        coalesce(
          nullif(current_setting('request.jwt.claim.roles', true), '')::jsonb,
          '[]'::jsonb
        )
      )
    );
  exception when others then
    v_claim := '{}';
  end;

  -- 2º (fallback): roles vigentes en usuarios_roles para el usuario del JWT
  select array(
    select r.nombre
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    where ur.perfil_id = public.usuario_actual()
      and r.activo
  ) into v_bd;

  return case
    when v_claim is not null and array_length(v_claim, 1) > 0 then v_claim
    when v_bd    is not null then v_bd
    else '{}'::text[]
  end;
end;
$$;

revoke execute on function public.roles_actuales() from public, anon;
grant execute on function public.roles_actuales() to authenticated;

comment on function public.roles_actuales() is
  'Roles del usuario: claim `roles` del JWT si existe; fallback a usuarios_roles (fuente de verdad) cuando el hook no inyecta el claim. Corrección SIR-UPSJB post-0010.';

-- ----------------------------------------------------------------------------
-- 2. Garantizar ADMINISTRADOR a joseeche21gd@gmail.com + sincronizar
--    (idéntico a asignar_admin_jose.sql; idempotente)
-- ----------------------------------------------------------------------------
do $$
declare
  v_auth_id uuid;
  v_rol     uuid;
begin
  select u.id into v_auth_id
    from auth.users u
   where u.email = 'joseeche21gd@gmail.com';

  if v_auth_id is null then
    raise notice 'AVISO: joseeche21gd@gmail.com no existe en auth.users (¿ya lo asignaste con asignar_admin_jose.sql?)';
    return;
  end if;

  insert into public.perfiles (id, nombres, apellido_paterno, correo)
  values (v_auth_id, 'Jose', 'Eche', 'joseeche21gd@gmail.com')
  on conflict (id) do nothing;

  update public.perfiles set estado = 'activo' where id = v_auth_id;

  select r.id into v_rol from public.roles r where r.nombre = 'ADMINISTRADOR';
  if v_rol is null then
    raise notice 'AVISO: no existe el rol ADMINISTRADOR (¿migración 0005 aplicada?)';
    return;
  end if;

  insert into public.usuarios_roles (perfil_id, rol_id)
  values (v_auth_id, v_rol)
  on conflict (perfil_id, rol_id) do nothing;

  perform public.sincronizar_roles_auth(v_auth_id);
  raise notice 'OK: ADMINISTRADOR garantizado y sincronizado para joseeche21gd@gmail.com';
end $$;

-- ----------------------------------------------------------------------------
-- 3. Estado del hook de access token (verificación NO crítica)
--    La tabla supabase_auth_admin.hook no existe en todas las versiones del
--    Auth (el nombre cambió entre releases), así que se consulta con guarda:
--    si no existe, decidirá el Dashboard manual (Authentication → Hooks).
-- ----------------------------------------------------------------------------
do $$
declare
  v_existe boolean;
begin
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'supabase_auth_admin'
       and table_name in ('hook', 'hooks')
  ) into v_existe;

  if v_existe then
    raise notice 'Tabla de hooks detectada; ejecuta la consulta incluida más abajo si existe la vista compatible.';
  else
    raise notice 'El esquema supabase_auth_admin no publica la tabla de hooks en este proyecto.
→ Revisa el hook manualmente: Dashboard → Authentication → Hooks → Custom Access Token Hook.
→ NO es bloqueante: el fallback del paso 1 cubre la app igualmente.';
  end if;
end $$;

-- Si quieres inspeccionar el hook manualmente (solo si la tabla existe):
-- select name, hook_table_keys, hook_query_keys
--   from supabase_auth_admin.hook
--  where name = 'custom_access_token_hook';

-- NOTA: si el select anterior no devuelve filas, el hook NO está configurado.
-- Actívalo en: Dashboard → Authentication → Hooks → Custom Access Token Hook
-- y selecciona la función public.custom_access_token_hook (migración 0010).
-- Con el fallback del paso 1 la app FUNCIONA igual, pero con el hook activo
-- el proxy protege rutas por panel en el borde (sin esperar al guard del
-- layout) y las RPC de notificaciones/realtime resuelven roles sin fallback.

-- ----------------------------------------------------------------------------
-- 4. VERIFICACIÓN FINAL: roles_db, roles en JWT (si hay hook), y permisos
--    efectivos de admin (debe salir ADMINISTRADOR en ambas columnas)
-- ----------------------------------------------------------------------------
select p.correo,
       p.estado,
       coalesce(array_agg(r.nombre order by r.nombre) filter (where r.nombre is not null), '{}') as roles_bd,
       a.raw_app_meta_data -> 'roles' as roles_en_auth_users
  from auth.users a
  join public.perfiles p on p.id = a.id
  left join public.usuarios_roles ur on ur.perfil_id = p.id
  left join public.roles r on r.id = ur.rol_id
 where a.email = 'joseeche21gd@gmail.com'
 group by p.id, p.correo, p.estado, a.raw_app_meta_data;
