-- ============================================================================
-- SIR-UPSJB · 0006_rls_funciones_auxiliares.sql
-- Seguridad: funciones auxiliares para RLS + endurecimiento del perímetro.
--
-- · Principio: la seguridad vive en PostgreSQL. El frontend oculta botones,
--   pero SIEMPRE el que decide es RLS (ver docs/01 §8.1 y FASES.md FASE 3).
--
-- Decisiones de diseño:
--   · El ROL del usuario viaja en el JWT (app_metadata.roles → GUC request.jwt.claim.roles).
--     app_metadata solo puede escribirlo el servidor (nunca el usuario: Supabase
--     no permite que el cliente modifique app_metadata) → no falsificable.
--   · Funciones STABLE SECURITY DEFINER con search_path fijo: RLS las llama
--     por fila; son seguras y rápidas (plan cacheado, sin recursión de policies).
--   · El PERMISO efectivo es la unión de los permisos de todos los roles (§8.1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ESQUEMA PRIVADO de apoyo (lo requieren las funciones de la sección 5 y la
-- tabla tecnico_area_admin de la sección 6; no se expone por la API PostgREST)
-- ----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 0. PERÍMETRO: sin GRANT no hay acceso, aunque RLS exista.
--    Supabase concede por defecto ALL a anon/authenticated sobre public;
--    se revoca y se concede de forma explícita y mínima. Las policies de 0007
--    filtrarán filas; estos privilegios limitan el alcance total.
-- ----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- La app necesita INSERT en incidencias y (con triggers)nextval de la secuencia QR.
grant usage, update on sequence public.sec_codigos_qr to authenticated;

-- ----------------------------------------------------------------------------
-- 1. Contexto del usuario en el request (GUC, no modifiable por el cliente
--    para app_metadata; el claim lo inyecta el servidor con cada request).
-- ----------------------------------------------------------------------------

-- UUID del usuario autenticado (NULL si es anónimo)
create or replace function public.usuario_actual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Identificadores de roles desde el JWT: app_metadata.roles (array de texto)
create or replace function public.roles_actuales()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(
          nullif(current_setting('request.jwt.claim.roles', true), '')::jsonb,
          '[]'::jsonb
        )
      )
    ),
    '{}'
  );
$$;

-- ¿El usuario autenticado tiene un perfil activo?
create or replace function public.perfil_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = public.usuario_actual()
      and p.estado = 'activo'
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Verificación de roles (Regla 8: roles múltiples, permiso = unión)
-- ----------------------------------------------------------------------------

-- ¿Tiene alguno de los roles indicados? (row security expression)
create or replace function public.tiene_rol(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.perfil_activo()
     and public.roles_actuales() && roles::text[];
$$;

-- ¿Su rol principal (el primero en el JWT) es exactamente este? [P]
create or replace function public.mi_rol_es(p_rol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.perfil_activo()
     and (public.roles_actuales())[1] = p_rol;
$$;

-- ----------------------------------------------------------------------------
-- 3. Verificación de permisos (permisos efectivos = unión por roles, §8.1)
--    Los permisos viven en la BD (roles_permisos); el JWT solo aporta los roles.
-- ----------------------------------------------------------------------------

create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permite boolean;
begin
  if not public.perfil_activo() then
    return false;
  end if;

  select exists (
    select 1
    from public.usuarios_roles ur
    join public.roles_permisos rp on rp.rol_id = ur.rol_id
    join public.permisos pe      on pe.id     = rp.permiso_id
   where ur.perfil_id = public.usuario_actual()
     and pe.codigo    = p_permiso
  ) into v_permite;

  return coalesce(v_permite, false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Verificación de ownership (Regla: el usuario solo opera lo suyo)
-- ----------------------------------------------------------------------------

-- ¿La incidencia fue reportada por el usuario actual?
create or replace function public.es_dueno_incidencia(p_incidencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.incidencias i
    where i.id = p_incidencia_id
      and i.usuario_reportante_id = public.usuario_actual()
  );
$$;

-- ¿El ticket es propio? Acepta id o código legible (p. ej. desde seguimiento).
create or replace function public.verificar_ownership_ticket(
  p_ticket_id uuid,
  p_codigo    text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.incidencias i
    where i.usuario_reportante_id = public.usuario_actual()
      and ( (p_ticket_id is not null and i.id = p_ticket_id)
         or (p_codigo    is not null and i.codigo = p_codigo) )
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. Verificación de área y sede (contexto TÉCNICO y COORDINADOR, §8.2)
-- ----------------------------------------------------------------------------

-- Área del técnico autenticado (NULL si no es técnico)
create or replace function public.mi_area_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.area_id
    from public.tecnicos t
   where t.perfil_id = public.usuario_actual()
     and t.activo
   limit 1;
$$;

-- ¿Es técnico activo?
create or replace function public.es_tecnico_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tecnicos t
    where t.perfil_id = public.usuario_actual()
      and t.activo
  );
$$;

-- ¿La incidencia pertenece al área del técnico? (derivación vigente = fila activa)
create or replace function public.incidencia_en_mi_area(p_incidencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.incidencia_derivaciones d
     where d.incidencia_id    = p_incidencia_id
       and d.activa
       and d.area_destino_id = public.mi_area_id()
  );
$$;

-- ¿Tengo una asignación activa de esa incidencia?
create or replace function public.tengo_asignacion_activa(p_incidencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.incidencia_asignaciones a
      join public.tecnicos t on t.id = a.tecnico_id
     where a.incidencia_id = p_incidencia_id
       and a.activa
       and t.perfil_id      = public.usuario_actual()
       and t.activo
  );
$$;

-- ¿Es coordinador del área X? (supervisión por área, §8.2)
create or replace function public.soy_coordinador_de_area(p_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_area_id is not null
     and public.tiene_rol('COORDINADOR')
     and p_area_id = coalesce(
       (select ta.area_id
          from private.tecnico_area_admin ta
         where ta.perfil_id = public.usuario_actual()),
       (select t.area_id
          from public.tecnicos t
         where t.perfil_id = public.usuario_actual()
           and t.activo)
     );
$$;

-- ¿Es coordinador (por sede o por área)? Bandera de capacidad.
create or replace function public.soy_coordinador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_rol('COORDINADOR')
     and exists (
       select 1 from private.tecnico_area_admin ta
        where ta.perfil_id = public.usuario_actual()
     );
$$;

-- ¿Es coordinador de la sede X?
create or replace function public.soy_coordinador_de_sede(p_sede_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sede_id is not null
     and public.tiene_rol('COORDINADOR')
     and exists (
       select 1
         from private.tecnico_area_admin ta
         join public.areas ar on ar.id = ta.area_id
        where ta.perfil_id  = public.usuario_actual()
          and ta.sede_id    = p_sede_id
          and ar.activo
     );
$$;

-- ¿Es administrador?
create or replace function public.soy_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_rol('ADMINISTRADOR');
$$;

-- ----------------------------------------------------------------------------
-- 6. Tablas internas de apoyo (esquema private: no expuesto por la API)
--    tecnico_area_admin: cobertura de COORDINADOR y TECNICO.
--      · rol = 'TECNICO'     → técnico asignado al área
--      · rol = 'COORDINADOR' → coordinador del área
--    La gestiona el ADMINISTRADOR (policy sobre esta tabla en 0007);
--    una fila por perfil/área.
-- ----------------------------------------------------------------------------
create table if not exists private.tecnico_area_admin (
  perfil_id   uuid        not null
              references public.perfiles (id) on delete cascade,
  area_id     uuid        not null
              references public.areas (id) on delete cascade,
  sede_id     uuid        not null
              references public.sedes (id) on delete restrict,
  rol         text        not null
              constraint ck_tecnico_area_admin_rol
              check (rol in ('TECNICO', 'COORDINADOR')),
  creado_en   timestamptz not null default now(),
  primary key (perfil_id, area_id, rol)
);

alter table private.tecnico_area_admin enable row level security;

-- ----------------------------------------------------------------------------
-- 7. Endurecimiento de funciones del esquema (0003):
--    solo lo imprescindible es ejecutable; el resto queda interno.
--    (Las funciones de trigger no requieren EXECUTE para dispararse.)
-- ----------------------------------------------------------------------------
revoke execute on function public.set_default_by_name(text, text, text)       from public, anon, authenticated;
revoke execute on function public.resolver_secuencia_incidencias()            from public, anon, authenticated;
revoke execute on function public.tiene_permiso(text)                         from public, anon;
revoke execute on function public.usuario_actual()                            from public, anon;
revoke execute on function public.roles_actuales()                            from public, anon;
revoke execute on function public.perfil_activo()                             from public, anon;
revoke execute on function public.verificar_ownership_ticket(uuid, text)      from public, anon;

grant execute on function public.set_default_by_name(text, text, text)        to authenticated;
grant execute on function public.resolver_secuencia_incidencias()             to authenticated;
grant execute on function public.tiene_permiso(text)                          to authenticated;
grant execute on function public.usuario_actual()                             to authenticated;
grant execute on function public.roles_actuales()                             to authenticated;
grant execute on function public.perfil_activo()                              to authenticated;
grant execute on function public.verificar_ownership_ticket(uuid, text)       to authenticated;
grant execute on function public.tiene_rol(variadic text[])                   to authenticated;
grant execute on function public.mi_rol_es(text)                              to authenticated;
grant execute on function public.es_dueno_incidencia(uuid)                    to authenticated;
grant execute on function public.es_tecnico_activo()                          to authenticated;
grant execute on function public.mi_area_id()                                 to authenticated;
grant execute on function public.incidencia_en_mi_area(uuid)                  to authenticated;
grant execute on function public.tengo_asignacion_activa(uuid)                to authenticated;
grant execute on function public.soy_coordinador_de_area(uuid)                to authenticated;
grant execute on function public.soy_coordinador()                            to authenticated;
grant execute on function public.soy_coordinador_de_sede(uuid)                to authenticated;
grant execute on function public.soy_administrador()                          to authenticated;

comment on function public.tiene_permiso(text) is
  'RLS: permiso efectivo = union de permisos de todos los roles del usuario (§8.1).';
comment on function public.usuario_actual() is
  'RLS: id del usuario desde request.jwt.claim.sub (servidor, no falsificable).';
comment on function public.roles_actuales() is
  'RLS: roles desde request.jwt.claim.roles (app_metadata; solo el servidor la escribe).';
