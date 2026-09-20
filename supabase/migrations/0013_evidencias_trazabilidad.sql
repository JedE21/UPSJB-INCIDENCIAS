-- ============================================================================
-- SIR-UPSJB · 0013_evidencias_trazabilidad.sql
-- Trazabilidad de incidencias: EVIDENCIAS (Storage privado) + COMENTARIOS +
-- HISTORIAL enriquecido con los eventos del Plan Maestro (CREAR, EDITAR,
-- ASIGNAR, DERIVAR, CAMBIAR_ESTADO, ADJUNTAR_EVIDENCIA, RESOLVER, CERRAR).
--
-- Decisiones de diseño:
--   · Los BINARIOS viven SOLO en Storage (bucket privado `evidencias`, 0009):
--     PostgreSQL guarda únicamente la referencia y metadatos en
--     `incidencia_adjuntos` (§2.5 del modelo). Nunca bytes en la BD.
--   · Validación de MIME y tamaño EN SERVIDOR (RPC): el bucket ya impone
--     allowed_mime_types + file_size_limit; la RPC lo revalida (defensa en
--     profundidad: no se confía solo en el frontend).
--   · El path respeta la convención de 0009:
--       <sede>/<año>/<incidencia_id>/<tipo>/<uuid>.<ext>
--     La RPC verifica que el path apunte a ESTA incidencia y que el objeto
--     exista en Storage antes de registrar los metadatos.
--   · Autorización en cada RPC (SECURITY DEFINER, search_path fijo):
--       adjuntar    → dueño, técnico asignado o admin + permiso adjuntar_evidencia.
--       eliminar    → SOLO ADMINISTRADOR (coherente con evidencias_delete 0009).
--       comentario  → dueño o técnico asignado + permiso comentar_incidencia;
--                     nota interna solo técnico/admin ([VI]: no visible al dueño).
--   · HISTORIAL append-only (D9): los eventos del flujo se escriben con
--     triggers SECURITY DEFINER (independientes de la app) y las RPC; ningún
--     cliente hace UPDATE/DELETE (0004 lo bloquea).
--   · Sin service_role: todo pasa por anon/authenticated + RLS/policies.
--   · Idempotente y re-ejecutable (or replace / drop if exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. path_evidencia_valido: acepta sede en mayúsculas (ck_sedes_codigo usa
--    '^[A-Z0-9-]+$'); la app genera el path con la sede en minúsculas, pero
--    la validación queda robusta a ambos.
-- ----------------------------------------------------------------------------
create or replace function public.path_evidencia_valido(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path ~ '^[A-Za-z0-9-]+/[0-9]{4}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(antes|durante|despues|documento|video)/[0-9a-fA-F-]+\.[a-z0-9]+$';
$$;

-- ============================================================================
-- 1. TRIGGERS DE TRAZABILIDAD (historial append-only, escritura en BD)
--    Reconstruyen la evolución sin depender de la aplicación:
--      CREAR · CAMBIAR_ESTADO (RESOLVER/CERRAR/CANCELAR) · EDITAR (descripción)
--      CAMBIO_DE_PRIORIDAD · ASIGNAR · DERIVAR
-- ============================================================================

-- ---- 1a. CREAR: fila inicial al registrar la incidencia --------------------
create or replace function public.historial_incidencia_crear()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select nombre into v_estado
  from public.estados_incidencia
  where id = new.estado_id;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (new.id, auth.uid(), 'otro', 'estado', null, v_estado,
     'CREAR: reporte registrado con código ' || new.codigo);
  return null;
end;
$$;

-- ---- 1b. CAMBIAR_ESTADO / RESOLVER / CERRAR · prioridad · EDITAR -----------
create or replace function public.historial_incidencia_actualizar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text;
  v_nuevo    text;
  v_detalle  text;
begin
  -- Cambio de estado (incluye RESOLVER y CERRAR según el estado destino).
  if old.estado_id is distinct from new.estado_id then
    select nombre into v_anterior from public.estados_incidencia where id = old.estado_id;
    select nombre into v_nuevo    from public.estados_incidencia where id = new.estado_id;

    v_detalle := case v_nuevo
      when 'Resuelta'  then 'RESOLVER: incidencia marcada como Resuelta'
      when 'Cerrada'   then 'CERRAR: incidencia cerrada por el reportante'
      when 'Cancelada' then 'CANCELAR: incidencia cancelada'
      else 'CAMBIAR_ESTADO: ' || coalesce(v_anterior, '—') || ' → ' || coalesce(v_nuevo, '—')
    end;

    insert into public.incidencia_historial
      (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
    values
      (new.id, auth.uid(), 'estado', 'estado', v_anterior, v_nuevo, v_detalle);
  end if;

  -- Cambio de prioridad.
  if old.prioridad_id is distinct from new.prioridad_id then
    select nombre into v_anterior from public.prioridades where id = old.prioridad_id;
    select nombre into v_nuevo    from public.prioridades where id = new.prioridad_id;

    insert into public.incidencia_historial
      (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
    values
      (new.id, auth.uid(), 'prioridad', 'prioridad', v_anterior, v_nuevo,
       'CAMBIAR_PRIORIDAD: ' || coalesce(v_anterior, '—') || ' → ' || coalesce(v_nuevo, '—'));
  end if;

  -- Edición de la descripción (EDITAR).
  if old.descripcion is distinct from new.descripcion then
    insert into public.incidencia_historial
      (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
    values
      (new.id, auth.uid(), 'edicion', 'descripcion', null, null,
       'EDITAR: descripción actualizada');
  end if;

  return null;
end;
$$;

-- ---- 1c. ASIGNAR: asignación activa a un técnico ---------------------------
create or replace function public.historial_asignacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tecnico text;
begin
  select nullif(btrim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), '')
  into v_tecnico
  from public.tecnicos t
  join public.perfiles p on p.id = t.perfil_id
  where t.id = new.tecnico_id;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (new.incidencia_id, coalesce(new.asignado_por, auth.uid()), 'asignacion',
     'tecnico', null, v_tecnico,
     'ASIGNAR: técnico ' || coalesce(v_tecnico, 'asignado'));
  return null;
end;
$$;

-- ---- 1d. DERIVAR: derivación entre áreas (incluye la inicial) --------------
create or replace function public.historial_derivacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_destino text;
  v_origen  text;
begin
  select nombre into v_destino from public.areas where id = new.area_destino_id;
  if new.area_origen_id is not null then
    select nombre into v_origen from public.areas where id = new.area_origen_id;
  end if;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (new.incidencia_id, coalesce(new.derivado_por, auth.uid()), 'derivacion',
     'area', v_origen, v_destino,
     'DERIVAR: ' || coalesce(v_origen, 'registro inicial') || ' → ' || coalesce(v_destino, '—'));
  return null;
end;
$$;

create trigger trg_incidencias_historial_crear
  after insert on public.incidencias
  for each row execute function public.historial_incidencia_crear();

create trigger trg_incidencias_historial_actualizar
  after update of estado_id, prioridad_id, descripcion on public.incidencias
  for each row execute function public.historial_incidencia_actualizar();

create trigger trg_asignaciones_historial
  after insert on public.incidencia_asignaciones
  for each row execute function public.historial_asignacion();

create trigger trg_derivaciones_historial
  after insert on public.incidencia_derivaciones
  for each row execute function public.historial_derivacion();

-- ============================================================================
-- 2. ADJUNTAR EVIDENCIA (metadatos + verificación del objeto + historial)
--    El ARCHIVO lo sube antes el cliente/servidor con el JWT del usuario
--    (policy evidencias_insert de 0009); esta RPC registra los metadatos solo
--    si el objeto existe en Storage. subido_por SIEMPRE = auth.uid().
-- ============================================================================

create or replace function public.adjuntar_evidencia(
  p_incidencia_id uuid,
  p_tipo          text,          -- antes|durante|despues|documento|video
  p_path          text,          -- convención 0009 (se revalida aquí)
  p_nombre        text,
  p_mime          text,
  p_tamano        bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max     bigint := 10485760;  -- 10 MB = file_size_limit del bucket (0009)
  v_validos text[] := array['image/jpeg','image/png','image/webp',
                            'application/pdf','video/mp4'];
  v_perfil  uuid;
  v_id      uuid;
begin
  -- a) Perfil activo + permiso adjuntar_evidencia (semilla 0005).
  if not public.perfil_activo() or not public.tiene_permiso('adjuntar_evidencia') then
    raise exception 'Tu rol no permite adjuntar evidencias';
  end if;

  -- b) Autorización sobre la incidencia: dueño, técnico asignado o admin
  --    (mismo criterio que p_adjuntos_insert de 0007).
  if not exists (
    select 1 from public.incidencias i
    where i.id = p_incidencia_id
      and (
        i.usuario_reportante_id = auth.uid()
        or public.tengo_asignacion_activa(p_incidencia_id)
        or public.soy_administrador()
      )
  ) then
    raise exception 'No autorizado para adjuntar a esta incidencia';
  end if;

  -- c) Tipo de evidencia (CHECK de BD).
  if p_tipo not in ('antes','durante','despues','documento','video') then
    raise exception 'Tipo de evidencia no válido';
  end if;

  -- d) MIME y tamaño validados EN SERVIDOR (no solo en el frontend).
  if p_mime is null or not (p_mime = any (v_validos)) then
    raise exception 'Formato no permitido. Usa JPG, PNG, WEBP, PDF o MP4';
  end if;
  if p_tamano is null or p_tamano <= 0 or p_tamano > v_max then
    raise exception 'El archivo supera el tamaño máximo (10 MB)';
  end if;

  -- e) Nombre de archivo presente (se recorta a la longitud de la columna).
  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'Falta el nombre del archivo';
  end if;

  -- f) El path debe cumplir la convención 0009 y apuntar a ESTA incidencia.
  if not public.path_evidencia_valido(p_path)
     or public.incidencia_de_path(p_path) is distinct from p_incidencia_id then
    raise exception 'Ruta de almacenamiento no válida';
  end if;

  -- g) El objeto ya debe existir en Storage: sin archivo no hay evidencia.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'evidencias' and o.name = p_path
  ) then
    raise exception 'El archivo no fue encontrado en Storage; súbelo antes de registrar la evidencia';
  end if;

  -- h) Metadatos: subido_por SIEMPRE de la sesión (nunca del cliente).
  select p.id into v_perfil
  from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo'
  limit 1;

  insert into public.incidencia_adjuntos
    (incidencia_id, subido_por, tipo, bucket, path, nombre_archivo, mime_type, tamano_bytes)
  values
    (p_incidencia_id, v_perfil, p_tipo, 'evidencias', p_path, left(btrim(p_nombre), 255),
     p_mime, p_tamano)
  returning id into v_id;

  -- i) Historial (append-only): evento ADJUNTAR_EVIDENCIA.
  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (p_incidencia_id, v_perfil, 'otro', 'evidencia', null, p_tipo,
     'ADJUNTAR_EVIDENCIA: ' || left(btrim(p_nombre), 400));

  return v_id;
end;
$$;

revoke all on function public.adjuntar_evidencia(uuid, text, text, text, text, bigint)
  from public, anon;
grant execute on function public.adjuntar_evidencia(uuid, text, text, text, text, bigint)
  to authenticated;

comment on function public.adjuntar_evidencia(uuid, text, text, text, text, bigint) is
  'Evidencias: valida MIME/tamaño en servidor, exige el objeto en Storage y registra metadatos + historial (binarios nunca en PostgreSQL).';

-- ============================================================================
-- 3. ELIMINAR EVIDENCIA — SOLO ADMINISTRADOR
--    Coherente con la policy evidencias_delete de 0009 (Storage). Retira el
--    objeto del bucket privado y los metadatos; deja constancia en historial.
-- ============================================================================

create or replace function public.eliminar_evidencia(p_evidencia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.incidencia_adjuntos%rowtype;
begin
  if not public.soy_administrador() then
    raise exception 'Solo un administrador puede eliminar evidencias';
  end if;

  select * into v_fila
  from public.incidencia_adjuntos
  where id = p_evidencia_id;

  if not found then
    raise exception 'Evidencia no encontrada';
  end if;

  -- Objeto del bucket privado (definer: pasa por aquí, la UI solo lo ofrece
  -- al admin; la policy evidencias_delete de 0009 es el respaldo).
  delete from storage.objects
   where bucket_id = v_fila.bucket and name = v_fila.path;

  -- Metadatos + evento de historial (append-only; solo INSERT).
  delete from public.incidencia_adjuntos where id = p_evidencia_id;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (v_fila.incidencia_id, auth.uid(), 'otro', 'evidencia', v_fila.tipo, null,
     'ELIMINAR_EVIDENCIA: ' || left(v_fila.nombre_archivo, 400));

  return true;
end;
$$;

revoke all on function public.eliminar_evidencia(uuid) from public, anon;
grant execute on function public.eliminar_evidencia(uuid) to authenticated;

comment on function public.eliminar_evidencia(uuid) is
  'Evidencias: eliminación restringida a ADMINISTRADOR (Storage + metadatos + historial).';

-- ============================================================================
-- 4. COMENTARIOS (dueño o técnico asignado; permiso comentar_incidencia)
--    Nota interna solo técnico/admin [VI]: el reportante no las ve
--    (la app filtra es_interno para el dueño; aquí no se le permite crearlas).
-- ============================================================================

create or replace function public.agregar_comentario(
  p_incidencia_id uuid,
  p_comentario    text,
  p_es_interno    boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  v_id     uuid;
  v_texto  text;
begin
  if not public.perfil_activo() or not public.tiene_permiso('comentar_incidencia') then
    raise exception 'Tu rol no permite comentar en esta incidencia';
  end if;

  -- Autorización: dueño o técnico con asignación activa (p_comentarios_insert).
  if not exists (
    select 1 from public.incidencias i
    where i.id = p_incidencia_id
      and (
        i.usuario_reportante_id = auth.uid()
        or public.tengo_asignacion_activa(p_incidencia_id)
      )
  ) then
    raise exception 'No autorizado para comentar en esta incidencia';
  end if;

  -- Nota interna: solo técnico asignado o admin; el dueño no puede crearla.
  if coalesce(p_es_interno, false)
     and not (public.tengo_asignacion_activa(p_incidencia_id) or public.soy_administrador()) then
    p_es_interno := false;
  end if;

  v_texto := btrim(coalesce(p_comentario, ''));
  if v_texto = '' then
    raise exception 'El comentario está vacío';
  end if;
  if char_length(v_texto) > 3000 then
    raise exception 'El comentario supera los 3000 caracteres';
  end if;

  select p.id into v_perfil
  from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo'
  limit 1;

  insert into public.incidencia_comentarios
    (incidencia_id, autor_id, comentario, es_interno)
  values
    (p_incidencia_id, v_perfil, v_texto, coalesce(p_es_interno, false))
  returning id into v_id;

  -- Historial (append-only): COMENTARIO (sin volcar el contenido completo).
  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (p_incidencia_id, v_perfil, 'otro', 'comentario', null, null,
     'COMENTARIO: ' || left(v_texto, 400));

  return v_id;
end;
$$;

revoke all on function public.agregar_comentario(uuid, text, boolean) from public, anon;
grant execute on function public.agregar_comentario(uuid, text, boolean) to authenticated;

comment on function public.agregar_comentario(uuid, text, boolean) is
  'Comentarios: dueño o técnico asignado con permiso; internos solo técnico/admin; registra COMENTARIO en historial.';

-- ============================================================================
-- 5. URL FIRMADA DE LECTURA (buckets privados, §2.5)
--    La signed URL se genera EN SERVIDOR; la policy evidencias_select de 0009
--    (replicada aquí) decide si el lector puede ver el objeto. Nunca bucket
--    público; expiración corta (5 min) para minimizar la ventana de enlace.
-- ============================================================================

create or replace function public.url_firma_evidencia(p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incidencia uuid := public.incidencia_de_path(p_path);
begin
  -- Path válido y de una incidencia existente.
  if v_incidencia is null or not public.path_evidencia_valido(p_path) then
    return null;
  end if;

  -- Misma autorización que evidencias_select (dueño, técnico asignado, admin).
  if not (
    public.es_dueno_por_path(p_path)
    or public.tengo_asignacion_por_path(p_path)
    or public.soy_administrador()
  ) then
    return null;
  end if;

  -- El objeto debe existir en el bucket privado.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'evidencias' and o.name = p_path
  ) then
    return null;
  end if;

  return storage.sign(name := p_path, bucket := 'evidencias', ext := 300);
end;
$$;

revoke all on function public.url_firma_evidencia(text) from public, anon;
grant execute on function public.url_firma_evidencia(text) to authenticated;

comment on function public.url_firma_evidencia(text) is
  'Evidencias: signed URL de 5 min generada en servidor; buckets privados nunca expuestos (0009).';

-- ============================================================================
-- 6. VERIFICACIÓN
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('adjuntar_evidencia','eliminar_evidencia','agregar_comentario',
       'url_firma_evidencia',
       'historial_incidencia_crear','historial_incidencia_actualizar',
       'historial_asignacion','historial_derivacion')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('adjuntar_evidencia','eliminar_evidencia','agregar_comentario',
       'url_firma_evidencia',
       'historial_incidencia_crear','historial_incidencia_actualizar',
       'historial_asignacion','historial_derivacion')
  ) <> 8 then
    raise exception 'RPCs/triggers de trazabilidad no creados correctamente';
  end if;
end
$$;
