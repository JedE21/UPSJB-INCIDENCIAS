-- ============================================================================
-- SIR-UPSJB · 0009_rls_storage.sql
-- Protección de Storage (§2.5 del modelo):
--   · Buckets PRIVADOS: el acceso es mediante signed URLs generadas en servidor.
--   · evidencias → archivos de incidencias (antes/durante/despues/documento/video).
--   · reportes   → exportaciones PDF/Excel/CSV (M14).
--   · Convención de path: <sede>/<año>/<incidencia_id>/<tipo>/<uuid>.<ext>
--     El uuid de la incidencia va SIEMPRE en el path: las policies lo extraen
--     y verifican ownership/asignación sin depender de filas de BD previas.
--   · UPDATE/DELETE del objeto: técnico asignado y admin (correcciones);
--     el dueño del ticket solo sube y ve sus evidencias.
--   · Sin service_role en el frontend: el cliente usa anon/authenticated y
--     pasa SIEMPRE por estas policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Buckets privados (configuración, sin credenciales)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidencias', 'evidencias', false, 10485760, array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf', 'video/mp4'
  ]),
  ('reportes',   'reportes',   false, 26214400, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Funciones auxiliares de Storage (SECURITY DEFINER, search_path fijo)
-- ----------------------------------------------------------------------------

-- Extrae el uuid de incidencia del path (null si no cumple la convención)
create or replace function public.incidencia_de_path(p_path text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select substring(
    p_path from '/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
  )::uuid;
$$;

-- ¿El path cumple la convención <sede>/<año>/<incidencia_id>/<tipo>/<archivo>?
create or replace function public.path_evidencia_valido(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path ~ '^[a-z0-9-]+/[0-9]{4}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(antes|durante|despues|documento|video)/[0-9a-fA-F-]+\.[a-z0-9]+$';
$$;

-- ¿Tengo asignación activa sobre la incidencia referenciada por el path?
create or replace function public.tengo_asignacion_por_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tengo_asignacion_activa(public.incidencia_de_path(p_path));
$$;

-- ¿Soy dueño de la incidencia referenciada por el path?
create or replace function public.es_dueno_por_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_dueno_incidencia(public.incidencia_de_path(p_path));
$$;

-- ----------------------------------------------------------------------------
-- 3. Policies de Storage — bucket evidencias
--    (drop if exists: re-ejecutable si una corrida previa quedó a medias)
-- ----------------------------------------------------------------------------

-- Subida: dueño del ticket o técnico asignado, con path válido
drop policy if exists "evidencias_insert" on storage.objects;
create policy "evidencias_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.perfil_activo()
    and public.path_evidencia_valido(name)
    and (
      public.es_dueno_por_path(name)
      or public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  );

-- Lectura: dueño, técnico asignado o admin (el GET directo pasa por aquí)
drop policy if exists "evidencias_select" on storage.objects;
create policy "evidencias_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and (
      public.es_dueno_por_path(name)
      or public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  );

-- Actualización (corregir evidencia): técnico asignado o admin
drop policy if exists "evidencias_update" on storage.objects;
create policy "evidencias_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'evidencias'
    and (
      public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  )
  with check (
    bucket_id = 'evidencias'
    and (
      public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  );

-- Eliminación: solo ADMINISTRADOR
drop policy if exists "evidencias_delete" on storage.objects;
create policy "evidencias_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 4. Policies de Storage — bucket reportes
-- ----------------------------------------------------------------------------

-- Subida: quien puede generar reportes
drop policy if exists "reportes_insert" on storage.objects;
create policy "reportes_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reportes'
    and public.tiene_permiso('ver_reportes')
  );

-- Lectura: el solicitante del reporte (el objeto lleva el id en el path) o admin
drop policy if exists "reportes_select" on storage.objects;
create policy "reportes_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reportes'
    and (
      public.soy_administrador()
      or exists (
        select 1
          from public.reportes_generados r
         where name like '%' || r.id::text || '%'
           and r.solicitado_por = public.usuario_actual()
      )
    )
  );

-- Actualización y borrado: solo ADMINISTRADOR
drop policy if exists "reportes_update" on storage.objects;
create policy "reportes_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'reportes' and public.soy_administrador())
  with check (bucket_id = 'reportes' and public.soy_administrador());

drop policy if exists "reportes_delete" on storage.objects;
create policy "reportes_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reportes' and public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 5. GRANT de uso del esquema storage (las policies deciden por objeto)
-- ----------------------------------------------------------------------------
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Verificación: buckets privados creados y storage.objects con RLS activo
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from storage.buckets
     where id in ('evidencias', 'reportes') and public = false
  ) then
    raise exception 'Buckets privados no creados correctamente';
  end if;

  if not exists (
    select 1
      from pg_tables
     where schemaname = 'storage'
       and tablename  = 'objects'
       and rowsecurity
  ) then
    raise exception 'storage.objects sin RLS';
  end if;
end
$$;
