-- ============================================================================
-- SIR-UPSJB · docs/verificacion-admin.sql  (VERIFICACIÓN — NO es migración)
-- FASE 7 — Pruebas CRUD y verificación RLS del panel administrativo.
--
-- Ejecutar en Supabase SQL Editor DESPUÉS de 0001–0014. Este script:
--   1. Verifica que todas las tablas administradas tienen RLS ENABLE.
--   2. Verifica que cada tabla tiene su policy de administración (p_*_admin).
--   3. Verifica el techo de GRANT (insert/update/delete) para authenticated.
--   4. Lista los permisos efectivos del rol ADMINISTRADOR.
--   5. (Opcional, comentario) Pruebas CRUD manuales con SET LOCAL role.
--
-- Todas las secciones lanzan EXCEPCIÓN si algo falta → el resultado visible
-- es "OK" o un error claro, sin ambigüedad.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS ENABLE en todas las entidades administradas
-- ----------------------------------------------------------------------------
do $$
declare
  faltan text;
begin
  select string_agg(t, ', ') into faltan
  from unnest(array[
    'perfiles','roles','permisos','roles_permisos','usuarios_roles',
    'sedes','pabellones','pisos','tipos_ambiente','ambientes','aulas','laboratorios',
    'categorias_equipos','marcas_equipos','modelos_equipos','estados_equipos',
    'equipos','equipos_ambientes','movimientos_equipos',
    'codigos_qr','areas','servicios','tecnicos','especialidades_tecnicas',
    'tecnicos_especialidades'
  ]) as t
  where not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = t and c.relrowsecurity
  );
  if faltan is not null then
    raise exception 'RLS desactivado en: %', faltan;
  end if;
  raise notice 'OK 1/4 — RLS ENABLE en todas las entidades administradas';
end $$;

-- ----------------------------------------------------------------------------
-- 2. Policy de administración por tabla (using soy_administrador)
--    Se busca CUALQUIER policy de la tabla cuyo qual/with_check invoque
--    soy_administrador() (los nombres concretos varían: p_*_admin).
-- ----------------------------------------------------------------------------
do $$
declare
  faltan text;
begin
  select string_agg(t, ', ') into faltan
  from unnest(array[
    'perfiles','roles','permisos','roles_permisos','usuarios_roles',
    'sedes','pabellones','pisos','tipos_ambiente','ambientes','aulas','laboratorios',
    'categorias_equipos','marcas_equipos','modelos_equipos','estados_equipos',
    'equipos','equipos_ambientes','movimientos_equipos',
    'codigos_qr','areas','servicios','tecnicos','especialidades_tecnicas',
    'tecnicos_especialidades'
  ]) as t
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename  = t
      and p.policyname like 'p_%'
      and (coalesce(p.qual,'') || coalesce(p.with_check,'')) like '%soy_administrador%'
  );
  if faltan is not null then
    raise exception 'Sin policy admin en: %', faltan;
  end if;
  raise notice 'OK 2/4 — Policies p_*_admin presentes en todas las entidades';
end $$;

-- ----------------------------------------------------------------------------
-- 3. Techo de GRANT: authenticated puede escribir (la policy filtra filas)
-- ----------------------------------------------------------------------------
do $$
declare
  faltan text;
begin
  select string_agg(t, ', ') into faltan
  from unnest(array[
    'roles','permisos','roles_permisos','usuarios_roles',
    'sedes','pabellones','pisos','tipos_ambiente','ambientes','aulas','laboratorios',
    'categorias_equipos','marcas_equipos','modelos_equipos','estados_equipos',
    'equipos','equipos_ambientes','movimientos_equipos','codigos_qr',
    'areas','servicios','tecnicos','especialidades_tecnicas','tecnicos_especialidades',
    'perfiles'
  ]) as t
  where exists (
    -- La tabla existe pero authenticated no tiene ni insert ni update ni delete
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join information_schema.role_table_grants g
      on g.table_schema = n.nspname and g.table_name = c.relname
       and g.grantee = 'authenticated'
    where n.nspname = 'public' and c.relname = t
    group by c.relname
    having not bool_or(g.privilege_type in ('INSERT','UPDATE','DELETE'))
  )
  or not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = t
  );
  if faltan is not null then
    raise exception 'GRANT insuficiente o tabla inexistente: %', faltan;
  end if;
  raise notice 'OK 3/4 — Techo de GRANT correcto para authenticated';
end $$;

-- ----------------------------------------------------------------------------
-- 4. Permisos del rol ADMINISTRADOR (semilla 0005): la matriz debe existir
-- ----------------------------------------------------------------------------
do $$
declare
  total int;
begin
  select count(*) into total
  from public.roles_permisos rp
  join public.roles r on r.id = rp.rol_id
  where r.nombre = 'ADMINISTRADOR';

  if total < 10 then
    raise exception 'El rol ADMINISTRADOR solo tiene % permisos (¿falta la semilla 0005?)', total;
  end if;
  raise notice 'OK 4/4 — ADMINISTRADOR tiene % permisos efectivos (unión por roles §8.1)', total;
end $$;

-- ============================================================================
-- 5. PRUEBAS CRUD MANUALES (opcional)
--
-- Descomenta para ejecutar una prueba de escritura REAL como authenticated
-- con un JWT de administrador. Sustituye <UUID_DE_USUARIO_ADMIN> por el id
-- de un perfil ADMINISTRADOR real de tu proyecto.
--
-- begin;
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<UUID_DE_USUARIO_ADMIN>';
--   set local request.jwt.claim.roles = '["ADMINISTRADOR"]';
--
--   -- CREATE: debe PERMITIR (admin)
--   insert into public.sedes (nombre, codigo, activa)
--   values ('Sede de prueba QA', 'QA', false);
--
--   -- READ: debe listar la fila recién creada
--   select nombre, codigo from public.sedes where codigo = 'QA';
--
--   -- UPDATE: debe PERMITIR
--   update public.sedes set direccion = 'Av. Prueba 123' where codigo = 'QA';
--
--   -- DELETE físico: el modelo no lo usa, pero el admin SÍ puede por GRANT;
--   -- aquí se elimina la fila de prueba para dejar la base limpia.
--   delete from public.sedes where codigo = 'QA';
-- end;
--
-- PRUEBA NEGATIVA (RLS debe RECHAZAR escritura de un no-admin):
-- begin;
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<UUID_DE_USUARIO_NORMAL>';
--   set local request.jwt.claim.roles = '["ESTUDIANTE"]';
--   -- Debe FALLAR con "new row violates row-level security policy"
--   insert into public.sedes (nombre, codigo) values ('Intruso', 'XX');
-- end;
-- ============================================================================
