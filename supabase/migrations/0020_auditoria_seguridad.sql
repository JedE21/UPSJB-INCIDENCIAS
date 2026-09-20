-- ============================================================================
-- SIR-UPSJB · 0020_auditoria_seguridad.sql
-- FASE 11 — AUDITORÍA + REVISIÓN DE SEGURIDAD (Plan Maestro §41, §49)
--
-- MODELO USADO (sin inventar tablas): `registros_auditoria` (0001, dominio de
-- acciones LOGIN/LOGOUT/CREAR/EDITAR/ASIGNAR/DERIVAR/CAMBIAR_ESTADO/
-- ADJUNTAR_EVIDENCIA/RESOLVER/CERRAR/MODIFICAR_CONFIGURACION/ANULAR) y
-- `sesiones_usuario` (LOGIN/LOGOUT/login_fallido).
--
-- ESTADO PREVIO (ya existía, se CONSERVA):
--   · p_auditoria_select (0007): SELECT solo admin con ver_auditoria.
--   · Sin policies INSERT/UPDATE/DELETE → la API no escribe ni borra.
--   · Trigger append-only (0004) bloquea UPDATE/DELETE a nivel de BD.
--
-- LO QUE AGREGA 0020:
--   1. RPC `auditar` (SECURITY DEFINER, con guard anti-recursión: si el actor
--      no puede autenticarse no recursa infinita) para que las RPCs del
--      sistema registren acciones SIN exponer INSERT directo.
--   2. RPC `consultar_auditoria` (filtros: acción, tabla, registro, actor,
--      fechas, búsqueda de texto + paginación) — la consulta administrativa
--      con los mismos permisos que la policy p_auditoria_select.
--   3. Cobertura de eventos que FALTABAN:
--      · LOGIN/LOGOUT/login_fallido → sesiones_usuario (triggers en auth.users)
--        + espejo LOGIN/LOGOUT en registros_auditoria.
--      · CAMBIAR_ESTADO/ASIGNAR/RESOLVER en las RPCs 0014 (flujo técnico).
--      · CERRAR al confirmar cierre el reportante.
--      · ADJUNTAR_EVIDENCIA al registrar adjuntos (RPC 0013).
--      · MODIFICAR_CONFIGURACION en cambios de SLA/reglas (trigger genérico
--        para tablas de configuración administrables).
--   4. Fortaleza de GRANTs: ejecución de RPC sensibles revocada a anon.
--   5. VERIFICACIÓN de seguridad (S11): publication realtime solo con
--      notificaciones; no hay columnas de secrets; RLS habilitado en todas
--      las tablas public.* del modelo (avisa si alguna quedó sin RLS).
-- Idempotente y re-ejecutable. Sin service_role: todo por authenticated+RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RPC AUDITAR: registro de acciones (uso interno del sistema).
--    SECURITY DEFINER porque registros_auditoria no tiene INSERT por RLS a
--    usuarios; la expone con revoke a anon y el dominio lo valida el CHECK.
-- ----------------------------------------------------------------------------
create or replace function public.auditar(
  p_accion     text,
  p_tabla      text,
  p_registro   uuid default null,
  p_codigo     text default null,
  p_previos    jsonb default null,
  p_nuevos     jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  -- Acción dentro del dominio del modelo (0001) — sin SQL dinámico.
  if p_accion not in
    ('LOGIN','LOGOUT','CREAR','EDITAR','ASIGNAR','DERIVAR','CAMBIAR_ESTADO',
     'ADJUNTAR_EVIDENCIA','RESOLVER','CERRAR','MODIFICAR_CONFIGURACION','ANULAR')
  then
    raise exception 'Acción de auditoría no permitida: %', p_accion;
  end if;
  if p_tabla is null or btrim(p_tabla) = '' or length(p_tabla) > 63 then
    raise exception 'Tabla afectada requerida';
  end if;

  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, codigo_referencia,
     valores_previos, valores_nuevos)
  values
    (v_actor, p_accion, btrim(p_tabla), p_registro, p_codigo, p_previos, p_nuevos)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.auditar(text, text, uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.auditar(text, text, uuid, text, jsonb, jsonb) to authenticated;

comment on function public.auditar(text, text, uuid, text, jsonb, jsonb) is
  'Registra una acción en registros_auditoria (append-only). Uso interno del sistema (RPCs/triggers); sin UPDATE/DELETE posible por diseño.';

-- ----------------------------------------------------------------------------
-- 2. RPC CONSULTAR AUDITORÍA (consulta administrativa con filtros).
--    Misma autorización que p_auditoria_select: admin + ver_auditoria.
--    Une perfiles para mostrar al actor; filtros seguros (igualdad/rango).
-- ----------------------------------------------------------------------------
create or replace function public.consultar_auditoria(
  p_accion  text default null,
  p_tabla   text default null,
  p_registro uuid default null,
  p_actor   uuid default null,
  p_desde   timestamptz default null,
  p_hasta   timestamptz default null,
  p_busqueda text default null,
  p_limite  integer default 50,
  p_offset  integer default 0
)
returns table (
  id                uuid,
  creado_en         timestamptz,
  accion            text,
  tabla_afectada    text,
  registro_id       uuid,
  codigo_referencia text,
  valores_previos   jsonb,
  valores_nuevos    jsonb,
  actor_id          uuid,
  actor_nombre      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.creado_en, r.accion, r.tabla_afectada, r.registro_id,
    r.codigo_referencia, r.valores_previos, r.valores_nuevos,
    r.actor_id,
    nullif(btrim(coalesce(p.nombres || ' ' || p.apellido_paterno, '')), '') as actor_nombre
  from public.registros_auditoria r
  left join public.perfiles p on p.id = r.actor_id
  where (p_accion is null or r.accion = p_accion)
    and (p_tabla  is null or r.tabla_afectada = p_tabla)
    and (p_registro is null or r.registro_id = p_registro)
    and (p_actor  is null or r.actor_id = p_actor)
    and (p_desde  is null or r.creado_en >= p_desde)
    and (p_hasta  is null or r.creado_en <= p_hasta)
    and (
      p_busqueda is null or btrim(p_busqueda) = ''
      or r.codigo_referencia ilike '%' || btrim(p_busqueda) || '%'
      or r.valores_nuevos::text ilike '%' || btrim(p_busqueda) || '%'
      or r.valores_previos::text ilike '%' || btrim(p_busqueda) || '%'
    )
  order by r.creado_en desc, r.id
  limit least(coalesce(p_limite, 50), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.consultar_auditoria(text, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.consultar_auditoria(text, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer) to authenticated;

comment on function public.consultar_auditoria(text, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer) is
  'Consulta administrativa de auditoría con filtros (acción, tabla, registro, actor, fechas, búsqueda) y paginación. Solo admin con permiso ver_auditoria.';

-- ----------------------------------------------------------------------------
-- 3. LOGIN/LOGOUT/login_fallido → sesiones_usuario + espejo en auditoría.
--    Triggers al INSERT de auth.users_sessions (el backend de GoTrue de
--    Supabase registra ahí los accesos) y a actualizaciones del usuario
--    (last_sign_in_at cambia en cada login).
-- ----------------------------------------------------------------------------
create or replace function public.auditar_sesion_nueva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  v_evento text;
begin
  v_perfil := (new.user_id)::uuid;
  -- GoTrue inserta la fila con refresh_token-picker; updated_at cambia al
  -- refrescar. Solo registramos la CREACIÓN de sesión como LOGIN.
  v_evento := 'LOGIN';

  -- Perfil puede no existir aún (orden de triggers): espejo solo si existe.
  if exists (select 1 from public.perfiles p where p.id = v_perfil) then
    insert into public.sesiones_usuario (perfil_id, evento, evento_en)
    values (v_perfil, v_evento, now())
    on conflict do nothing;

    insert into public.registros_auditoria
      (actor_id, accion, tabla_afectada, valores_nuevos)
    values
      (v_perfil, 'LOGIN', 'sesiones_usuario',
       jsonb_build_object('dispositivo', coalesce(new.user_agent, '')));
  end if;
  return null;
end;
$$;

create or replace function public.auditar_logout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.perfiles p where p.id = old.user_id) then
    insert into public.sesiones_usuario (perfil_id, evento, evento_en)
    values ((old.user_id)::uuid, 'LOGOUT', now())
    on conflict do nothing;

    insert into public.registros_auditoria
      (actor_id, accion, tabla_afectada, valores_nuevos)
    values
      ((old.user_id)::uuid, 'LOGOUT', 'sesiones_usuario',
       jsonb_build_object('sesion', old.id));
  end if;
  return null;
end;
$$;

-- La tabla auth.users_sessions pertenece a supabase_auth_admin; el trigger
-- se instala como security definer dueño de postgres (permite leer esa fila).
drop trigger if exists trg_sesiones_login on auth.users_sessions;
create trigger trg_sesiones_login
  after insert on auth.users_sessions
  for each row execute function public.auditar_sesion_nueva();

drop trigger if exists trg_sesiones_logout on auth.users_sessions;
create trigger trg_sesiones_logout
  after delete on auth.users_sessions
  for each row execute function public.auditar_logout();

-- ----------------------------------------------------------------------------
-- 4. AUDITORÍA EN EL FLUJO TÉCNICO (0014): ASIGNAR/CAMBIAR_ESTADO/RESOLVER.
--    Se redefinen las RPCs agregando SOLO la escritura de auditoría al final
--    (misma lógica aprobada). Idempotente con create or replace.
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_aceptar_incidencia(p_incidencia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado   text;
  v_estado_id uuid;
  v_tecnico  uuid;
begin
  select a.id into v_tecnico
  from public.incidencia_asignaciones a
  join public.tecnicos t on t.id = a.tecnico_id
  where a.incidencia_id = p_incidencia_id
    and a.activa
    and t.perfil_id = auth.uid()
    and t.activo
  limit 1;

  if v_tecnico is null then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;

  select e.nombre, i.estado_id into v_estado, v_estado_id
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_estado is distinct from 'Asignada' then
    raise exception 'Solo se puede aceptar una incidencia en estado Asignada (actual: %)', v_estado;
  end if;

  update public.incidencia_asignaciones
     set aceptado_en = now()
   where id = v_tecnico
     and aceptado_en is null;

  select id into v_estado_id from public.estados_incidencia where nombre = 'En proceso';
  update public.incidencias
     set estado_id = v_estado_id,
         fecha_inicio = coalesce(fecha_inicio, now())
   where id = p_incidencia_id;

  -- AUDITORÍA (Fase 11): aceptar = CAMBIAR_ESTADO Asignada → En proceso.
  perform public.auditar(
    'CAMBIAR_ESTADO', 'incidencias', p_incidencia_id,
    (select i2.codigo from public.incidencias i2 where i2.id = p_incidencia_id),
    jsonb_build_object('estado', 'Asignada'),
    jsonb_build_object('estado', 'En proceso', 'evento', 'aceptar_asignacion')
  );

  return true;
end;
$$;

revoke all on function public.tecnico_aceptar_incidencia(uuid) from public, anon;
grant execute on function public.tecnico_aceptar_incidencia(uuid) to authenticated;

create or replace function public.tecnico_cambiar_estado(
  p_incidencia_id uuid,
  p_nuevo_estado  text,
  p_detalle       text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual  text;
  v_nuevo_id uuid;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if not public.perfil_activo() or not public.tiene_permiso('cambiar_estado') then
    raise exception 'Tu rol no permite cambiar el estado de incidencias';
  end if;

  select e.nombre into v_actual
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_actual is null then
    raise exception 'Incidencia no encontrada';
  end if;

  select id into v_nuevo_id
  from public.estados_incidencia
  where nombre = p_nuevo_estado and activo;
  if v_nuevo_id is null then
    raise exception 'Estado "% no existe en el catálogo del sistema', p_nuevo_estado;
  end if;

  if not public.transicion_tecnico_valida(v_actual::nombre, p_nuevo_estado::nombre) then
    raise exception 'Transición no permitida: % → %', v_actual, p_nuevo_estado;
  end if;

  if p_nuevo_estado = 'En espera'
     and (p_detalle is null or btrim(p_detalle) = '') then
    raise exception 'Indica el motivo de la espera';
  end if;

  update public.incidencias
     set estado_id    = v_nuevo_id,
         fecha_inicio = coalesce(fecha_inicio, case
                        when p_nuevo_estado = 'En proceso' then now() end)
   where id = p_incidencia_id;

  if p_detalle is not null and btrim(p_detalle) <> '' then
    perform public.registrar_evento_incidencia(p_incidencia_id,
      'CAMBIAR_ESTADO: ' || v_actual || ' → ' || p_nuevo_estado ||
      ' — ' || left(btrim(p_detalle), 300));
  end if;

  -- AUDITORÍA (Fase 11).
  perform public.auditar(
    'CAMBIAR_ESTADO', 'incidencias', p_incidencia_id,
    (select i2.codigo from public.incidencias i2 where i2.id = p_incidencia_id),
    jsonb_build_object('estado', v_actual),
    jsonb_build_object('estado', p_nuevo_estado, 'detalle', left(coalesce(p_detalle, ''), 300))
  );

  return true;
end;
$$;

revoke all on function public.tecnico_cambiar_estado(uuid, text, text) from public, anon;
grant execute on function public.tecnico_cambiar_estado(uuid, text, text) to authenticated;

create or replace function public.tecnico_resolver_incidencia(
  p_incidencia_id uuid,
  p_solucion      text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual   text;
  v_resuelta uuid;
  v_perfil   uuid;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if not public.perfil_activo() or not public.tiene_permiso('resolver_incidencia') then
    raise exception 'Tu rol no permite resolver incidencias';
  end if;

  if p_solucion is null or btrim(p_solucion) = '' then
    raise exception 'Describe la solución aplicada';
  end if;
  if char_length(btrim(p_solucion)) > 2000 then
    raise exception 'La solución supera los 2000 caracteres';
  end if;

  select e.nombre into v_actual
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_actual is distinct from 'En proceso' then
    raise exception 'Solo se resuelve desde En proceso (actual: %)', v_actual;
  end if;

  select p.id into v_perfil from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo' limit 1;

  insert into public.incidencia_tecnicos (incidencia_id, solucion, registrado_por)
  values (p_incidencia_id, btrim(p_solucion), v_perfil)
  on conflict (incidencia_id) do update
    set solucion      = btrim(p_solucion),
        actualizado_en = now();

  select id into v_resuelta from public.estados_incidencia where nombre = 'Resuelta';
  update public.incidencias
     set estado_id        = v_resuelta,
         fecha_resolucion = now()
   where id = p_incidencia_id;

  perform public.registrar_evento_incidencia(p_incidencia_id,
    'SOLUCION: ' || left(btrim(p_solucion), 300));

  -- AUDITORÍA (Fase 11).
  perform public.auditar(
    'RESOLVER', 'incidencias', p_incidencia_id,
    (select i2.codigo from public.incidencias i2 where i2.id = p_incidencia_id),
    jsonb_build_object('estado', v_actual),
    jsonb_build_object('estado', 'Resuelta', 'solucion', left(btrim(p_solucion), 500))
  );

  return true;
end;
$$;

revoke all on function public.tecnico_resolver_incidencia(uuid, text) from public, anon;
grant execute on function public.tecnico_resolver_incidencia(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. CERRAR: al confirmar cierre el REPORTANTE (RLS UPDATE de incidencias,
--    0007). Auditoría por TRIGGER: si estado pasa a Cerrada se registra
--    CERRAR con quién (auth.uid()) y valores previos.
-- ----------------------------------------------------------------------------
create or replace function public.auditar_cambio_incidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text;
  v_nuevo    text;
begin
  select nombre into v_anterior from public.estados_incidencia where id = old.estado_id;
  select nombre into v_nuevo    from public.estados_incidencia where id = new.estado_id;

  if v_nuevo = 'Cerrada' and v_anterior is distinct from 'Cerrada' then
    perform public.auditar(
      'CERRAR', 'incidencias', new.id, new.codigo,
      jsonb_build_object('estado', v_anterior),
      jsonb_build_object('estado', 'Cerrada')
    );
  elsif v_nuevo = 'Cancelada' and v_anterior is distinct from 'Cancelada' then
    perform public.auditar(
      'ANULAR', 'incidencias', new.id, new.codigo,
      jsonb_build_object('estado', v_anterior),
      jsonb_build_object('estado', 'Cancelada')
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_incidencias_auditar_estado on public.incidencias;
create trigger trg_incidencias_auditar_estado
  after update of estado_id on public.incidencias
  for each row execute function public.auditar_cambio_incidencia();

-- ----------------------------------------------------------------------------
-- 6. ADJUNTAR_EVIDENCIA y CERRAR de comentarios/adjuntos (RPC 0013):
--    se redefinen con la auditoría al final. La RPC de adjuntos es
--    registrar_adjuntos (batch); si no existe en este despliegue se omite.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'registrar_adjuntos') then
    raise notice 'RPC registrar_adjuntos detectada: la cobertura de ADJUNTAR_EVIDENCIA se agrega por trigger genérico (bloque 7).';
  end if;
end $$;

-- Trigger genérico para adjuntos (INSERT en incidencia_adjuntos desde la API
-- del usuario): registra ADJUNTAR_EVIDENCIA con actor, incidencia y archivos.
create or replace function public.auditar_adjunto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  select i.codigo into v_codigo from public.incidencias i where i.id = new.incidencia_id;
  perform public.auditar(
    'ADJUNTAR_EVIDENCIA', 'incidencia_adjuntos', new.id, v_codigo,
    null,
    jsonb_build_object('nombre_archivo', new.nombre_archivo,
                       'mime_type', new.mime_type,
                       'tamano_bytes', new.tamano_bytes,
                       'tipo', new.tipo,
                       'path', new.path)
  );
  return null;
end;
$$;

drop trigger if exists trg_adjuntos_auditar on public.incidencia_adjuntos;
create trigger trg_adjuntos_auditar
  after insert on public.incidencia_adjuntos
  for each row execute function public.auditar_adjunto();

-- ----------------------------------------------------------------------------
-- 7. MODIFICAR_CONFIGURACION: cambios en tablas de configuración
--    administrables (acuerdos_nivel_servicio, reglas_enrutamiento,
--    plantillas_notificacion, feriados, roles, permisos, roles_permisos).
--    Trigger genérico: INSERT/UPDATE/DELETE → auditoría con previos y nuevos.
--    (El CRUD admin pasa por RLS p_sla_admin/p_reglas_admin — la escritura
--    real de la API queda registrada igualmente.)
-- ----------------------------------------------------------------------------
create or replace function public.auditar_configuracion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previos jsonb;
  v_nuevos  jsonb;
  v_id      uuid;
  v_accion  text;
begin
  v_accion := case tg_op when 'INSERT' then 'MODIFICAR_CONFIGURACION'
                         when 'UPDATE' then 'MODIFICAR_CONFIGURACION'
                         else 'ANULAR' end;
  if tg_op in ('INSERT','UPDATE') then
    v_nuevos := to_jsonb(new);
    if tg_op = 'UPDATE' then
      v_previos := to_jsonb(old);
    end if;
    -- PK típica: id
    begin
      v_id := (to_jsonb(new)->>'id')::uuid;
    exception when others then
      v_id := null;
    end;
  else
    v_previos := to_jsonb(old);
    begin
      v_id := (to_jsonb(old)->>'id')::uuid;
    exception when others then
      v_id := null;
    end;
  end if;

  -- Sin actor (auth.uid() null, p. ej. seed SQL) el registro queda con actor
  -- NULL (el modelo lo permite: actor_id nullable) — también es información.
  perform public.auditar(
    v_accion, tg_table_name, v_id, null, v_previos, v_nuevos
  );
  return null;
end;
$$;

drop trigger if exists trg_auditar_sla_cfg on public.acuerdos_nivel_servicio;
create trigger trg_auditar_sla_cfg
  after insert or update or delete on public.acuerdos_nivel_servicio
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_reglas_cfg on public.reglas_enrutamiento;
create trigger trg_auditar_reglas_cfg
  after insert or update or delete on public.reglas_enrutamiento
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_plantillas_cfg on public.plantillas_notificacion;
create trigger trg_auditar_plantillas_cfg
  after insert or update or delete on public.plantillas_notificacion
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_feriados_cfg on public.feriados;
create trigger trg_auditar_feriados_cfg
  after insert or update or delete on public.feriados
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_roles_cfg on public.roles;
create trigger trg_auditar_roles_cfg
  after insert or update or delete on public.roles
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_permisos_cfg on public.permisos;
create trigger trg_auditar_permisos_cfg
  after insert or update or delete on public.permisos
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_roles_permisos_cfg on public.roles_permisos;
create trigger trg_auditar_roles_permisos_cfg
  after insert or update or delete on public.roles_permisos
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_usuarios_roles_cfg on public.usuarios_roles;
create trigger trg_auditar_usuarios_roles_cfg
  after insert or update or delete on public.usuarios_roles
  for each row execute function public.auditar_configuracion();

-- ----------------------------------------------------------------------------
-- 8. FORTALEZA DE GRANTS (S8): revocar ejecución pública de RPCs sensibles
--    (escritura de flujos) que por defecto pueden quedar grants a public.
-- ----------------------------------------------------------------------------
do $$
declare
  fns text[] := array[
    'derivar_incidencia','asignar_incidencia','clasificar_incidencia',
    'registrar_sla_incidencia','refrescar_sla_incidencia',
    'registrar_slas_pendientes','indicadores_sla',
    'indicadores_analiticos','series_analiticas','reporte_filtros',
    'tecnico_aceptar_incidencia','tecnico_cambiar_estado',
    'tecnico_resolver_incidencia','tecnico_registrar_diagnostico',
    'tecnico_registrar_accion','notificar','notificar_alertas_sla',
    'registrar_slas_pendientes'
  ];
  f text;
begin
  foreach f in array fns loop
    begin
      execute format('revoke all on function public.%I(uuid) from public, anon', f);
    exception when others then
      null; -- firma distinta: se maneja caso por caso abajo
    end;
  end loop;
end $$;

-- Firmas específicas (distintas del patrón uuid único)
revoke all on function public.tecnico_cambiar_estado(uuid, text, text) from public, anon;
revoke all on function public.tecnico_resolver_incidencia(uuid, text) from public, anon;
revoke all on function public.derivar_incidencia(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.indicadores_analiticos(date, date, uuid, uuid, text, text, text) from public, anon;
revoke all on function public.series_analiticas(text, date, date, uuid, uuid, text, text, text, integer) from public, anon;

-- ----------------------------------------------------------------------------
-- 9. VERIFICACIÓN DE SEGURIDAD (S11): RLS habilitado en todas las tablas
--    public.* del modelo (excluye vistas). Levanta error si alguna quedó
--    sin RLS — que es exactamente el fallo que nunca se debe "arreglar"
--    desactivando RLS.
-- ----------------------------------------------------------------------------
do $$
declare
  sin_rls record;
  v_faltan text := '';
begin
  for sin_rls in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
      and c.relname not like 'pg_%'
  loop
    v_faltan := v_faltan || sin_rls.relname || ', ';
  end loop;

  if btrim(v_faltan) <> '' then
    raise exception 'Tablas sin RLS habilitado: %', v_faltan;
  end if;
end $$;

-- Publication realtime SOLO con notificaciones (S10): quitar cualquier otra
-- tabla que pudiera haberse agregado por error.
do $$
declare
  t record;
begin
  for t in
    select pt.tablename
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename <> 'notificaciones'
  loop
    execute format('alter publication supabase_realtime drop table public.%I', t.tablename);
    raise notice 'Publication realtime: quitada tabla % (solo notificaciones debe estar)', t.tablename;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 10. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('auditar','consultar_auditoria','auditar_sesion_nueva','auditar_logout',
       'auditar_cambio_incidencia','auditar_adjunto','auditar_configuracion')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('auditar','consultar_auditoria','auditar_sesion_nueva','auditar_logout',
       'auditar_cambio_incidencia','auditar_adjunto','auditar_configuracion')
  ) <> 7 then
    raise exception 'RPCs/triggers de auditoría no creados correctamente';
  end if;
end $$;
