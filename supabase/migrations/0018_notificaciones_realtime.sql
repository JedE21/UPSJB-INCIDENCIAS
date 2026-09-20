-- ============================================================================
-- SIR-UPSJB · 0018_notificaciones_realtime.sql
-- FASE 9 — NOTIFICACIONES INTERNAS + SUPABASE REALTIME (Plan Maestro §20 y
-- §33; diseño de BD docs/01 §3.10 — modelo APROBADO, tablas existentes).
--
-- MODELO USADO (sin inventar tablas):
--   · notificaciones          → bandeja por perfil (FK incidencia opcional).
--   · plantillas_notificacion → asunto/cuerpo por evento (canal interna/
--     correo/push). Las plantillas de canal CORREO ya existen como datos; el
--     ENVÍO real queda preparado pero NO activo (sin proveedor aprobado).
--   · preferencias_notificacion → opt-out por usuario/evento (PK compuesta).
--
-- NOTIFICACIÓN EN TIEMPO REAL (segura):
--   · La tabla `notificaciones` se agrega a la PUBLICATION supabase_realtime.
--   · Realtime (postgres_changes) aplica las policies RLS de la tabla a cada
--     suscriptor: cada usuario recibe SOLO las filas de SU perfil
--     (p_notificaciones_select, 0007: perfil_id = usuario_actual()). Nadie
--     recibe datos de incidencias que no pueda ver.
--   · Payload mínimo: la fila ya es personal (titulo/cuerpo), no se publican
--     tablas operativas (incidencias NO va a la publication).
--
-- EVENTOS QUE GENERAN NOTIFICACIÓN (triggers AFTER COMMIT-queue en BD, sin
-- depender de la app): nueva_incidencia · asignada · derivada ·
-- en_proceso · en_espera · resuelta · cerrada · cancelada · comentario ·
-- sla_alerta. El dominio de eventos de plantillas/preferencias se AMPLÍA con
-- 'derivada' y 'sla_alerta' (nuevos, coherentes con el flujo §30; no se
-- reutilizan eventos con otro significado). Las semillas de plantilla para
-- los nuevos eventos se agregan aquí (marcadas [P]).
--
-- DESTINATARIOS (fuente de verdad = modelo, no hardcodeo de roles):
--   · nueva_incidencia → REPORTANTE (confirmación con su código).
--   · asignada         → TÉCNICO con asignación activa.
--   · derivada         → REPORTANTE (su ticket cambió de área responsable).
--   · en_proceso/en_espera/resuelta/cerrada/cancelada → REPORTANTE.
--   · comentario       → REPORTANTE (solo si el comentario NO es interno).
--   · sla_alerta       → TÉCNICO con asignación activa (RPC dedicada).
-- Los correlatores técnicos (coordinadores/admin) quedan para una fase de
-- reportes; aquí no se inventan reglas de destinatarios adicionales.
--
-- La TABLA notificaciones la escribe solo el SISTEMA (triggers/RPC SECURITY
-- DEFINER); el usuario SOLO lee y marca leídas (policy p_notificaciones_update
-- de 0007 limita UPDATE a leida_en de su propia fila).
--
-- CORREO: preparado, NO activo. plantillas_notificacion.canal='correo' existe;
-- la colita de envío (proveedor SMTP/API) se conectará cuando la institución
-- apruebe proveedor; SIN credenciales hardcodeadas (irán en env de servidor).
-- Sin service_role: todo por authenticated + RLS.
-- Idempotente y re-ejecutable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DOMINIO DE EVENTOS ampliado (derivada · sla_alerta)
--    ALTER tipo CHECK: drop constraint + re-add con el dominio completo.
-- ----------------------------------------------------------------------------
alter table public.plantillas_notificacion
  drop constraint if exists ck_plantillas_notificacion_evento;
alter table public.plantillas_notificacion
  add constraint ck_plantillas_notificacion_evento
  check (evento in
    ('nueva_incidencia', 'asignada', 'derivada', 'en_proceso', 'en_espera',
     'resuelta', 'cerrada', 'cancelada', 'comentario', 'sla_alerta'));

alter table public.preferencias_notificacion
  drop constraint if exists ck_preferencias_notificacion_evento;
alter table public.preferencias_notificacion
  add constraint ck_preferencias_notificacion_evento
  check (evento in
    ('nueva_incidencia', 'asignada', 'derivada', 'en_proceso', 'en_espera',
     'resuelta', 'cerrada', 'cancelada', 'comentario', 'sla_alerta'));

-- Plantillas de los NUEVOS eventos [P] (los 8 originales vienen de 0005)
insert into public.plantillas_notificacion (evento, asunto, cuerpo, canal) values
  ('derivada', 'Incidencia {{codigo}} derivada',
   'Tu incidencia {{codigo}} fue derivada al área responsable: {{area}}. Sigue su progreso con el código.', 'interna'),
  ('sla_alerta', 'SLA en riesgo: {{codigo}}',
   'El SLA de la incidencia {{codigo}} está próximo a vencer o venció. Revísala cuanto antes.', 'interna')
on conflict (evento) do nothing;

-- ----------------------------------------------------------------------------
-- 2. PREFERENCIAS POR DEFECTO (opt-out): una fila por usuario/evento con
--    habilitado = true. ON CONFLICT no pisa lo que el usuario ya eligió.
--    Se crean automáticamente al aparecer el perfil (trigger) y al usarse.
-- ----------------------------------------------------------------------------
create or replace function public.crear_preferencias_notificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.preferencias_notificacion (perfil_id, evento, habilitado)
  select new.id, e.evento, true
  from (values
    ('nueva_incidencia'), ('asignada'), ('derivada'), ('en_proceso'),
    ('en_espera'), ('resuelta'), ('cerrada'), ('cancelada'),
    ('comentario'), ('sla_alerta')
  ) as e(evento)
  on conflict (perfil_id, evento) do nothing;
  return null;
end;
$$;

drop trigger if exists trg_preferencias_al_crear_perfil on public.perfiles;
create trigger trg_preferencias_al_crear_perfil
  after insert on public.perfiles
  for each row execute function public.crear_preferencias_notificacion();

-- ¿Quiere el usuario recibir este evento? (opt-out; sin fila = habilitado)
create or replace function public.usuario_quiere_evento(
  p_perfil uuid,
  p_evento text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select habilitado
     from public.preferencias_notificacion
     where perfil_id = p_perfil and evento = p_evento),
    true
  );
$$;

revoke all on function public.usuario_quiere_evento(uuid, text) from public, anon;
grant execute on function public.usuario_quiere_evento(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. NÚCLEO: CREAR NOTIFICACIÓN (dedupe por evento+incidencia+destinatario)
-- ----------------------------------------------------------------------------
create or replace function public.notificar(
  p_perfil_id uuid,
  p_evento    text,
  p_incidencia_id uuid default null,
  p_titulo    text default null,
  p_cuerpo    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plantilla record;
  v_titulo text;
  v_cuerpo text;
  v_id uuid;
begin
  if p_perfil_id is null then
    return null; -- sin destinatario (p. ej. reporte anónimo) → nada
  end if;

  -- Preferencias del destinatario (opt-out por evento; sin fila = habilitado).
  if not public.usuario_quiere_evento(p_perfil_id, p_evento) then
    return null;
  end if;

  -- Plantilla activa del evento (canal interna; el correo es de la cola futura).
  select asunto, cuerpo, id into v_plantilla
  from public.plantillas_notificacion
  where evento = p_evento and activo and canal = 'interna'
  limit 1;

  if v_plantilla is null then
    return null; -- sin plantilla activa → no se inventa contenido
  end if;

  v_titulo := coalesce(p_titulo, v_plantilla.asunto);
  v_cuerpo := coalesce(p_cuerpo, v_plantilla.cuerpo);

  -- Dedupe: mismo evento + misma incidencia + mismo destinatario (la fila
  -- persiste aunque la vuelvan a disparar; no satura la bandeja).
  insert into public.notificaciones
    (perfil_id, incidencia_id, plantilla_id, titulo, cuerpo)
  select p_perfil_id, p_incidencia_id, v_plantilla.id, v_titulo, v_cuerpo
  where not exists (
    select 1 from public.notificaciones n
    where n.perfil_id = p_perfil_id
      and n.plantilla_id = v_plantilla.id
      and n.incidencia_id is not distinct from p_incidencia_id
      and n.leida_en is null
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.notificar(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.notificar(uuid, text, uuid, text, text) to authenticated;

comment on function public.notificar(uuid, text, uuid, text, text) is
  'Crea una notificación interna aplicando preferencias del destinatario y plantilla activa del evento (dedupe por evento+incidencia+destinatario no leída).';

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS DE EVENTOS DEL FLUJO (escritura en BD, independiente de la app)
--    Suppress timestamps: evita notificar DOS veces cuando el trigger del
--    sistema y la acción del usuario ocurren en la misma transacción.
-- ----------------------------------------------------------------------------

-- Mapa de placeholders: {{codigo}}, {{ambiente}}, {{area}}, {{detalle}}
create or replace function public.notif_contexto_incidencia(p_incidencia_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'codigo', i.codigo,
    'ambiente', coalesce(a.nombre, '—'),
    'area', coalesce(
      (select ar.nombre
       from public.incidencia_derivaciones d
       join public.areas ar on ar.id = d.area_destino_id
       where d.incidencia_id = i.id and d.activa limit 1), ''),
    'detalle', ''
  )
  from public.incidencias i
  left join public.ambientes a on a.id = i.ambiente_id
  where i.id = p_incidencia_id;
$$;

create or replace function public.notif_reemplazar(text, jsonb)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(
    $1, '{{codigo}}', coalesce($2->>'codigo', '')),
    '{{ambiente}}', coalesce($2->>'ambiente', '')),
    '{{area}}', coalesce($2->>'area', '')),
    '{{detalle}}', coalesce($2->>'detalle', ''));
$$;

-- 4a. NUEVA INCIDENCIA → al reportante
create or replace function public.notif_incidencia_creada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx jsonb;
begin
  if new.usuario_reportante_id is null then
    return null; -- reporte anónimo: no hay a quién notificar
  end if;
  v_ctx := public.notif_contexto_incidencia(new.id);
  perform public.notificar(
    new.usuario_reportante_id, 'nueva_incidencia', new.id,
    public.notif_reemplazar(
      (select asunto from public.plantillas_notificacion
        where evento = 'nueva_incidencia' and activo and canal = 'interna' limit 1), v_ctx),
    public.notif_reemplazar(
      (select cuerpo from public.plantillas_notificacion
        where evento = 'nueva_incidencia' and activo and canal = 'interna' limit 1), v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_incidencia_creada on public.incidencias;
create trigger trg_notif_incidencia_creada
  after insert on public.incidencias
  for each row execute function public.notif_incidencia_creada();

-- 4b. CAMBIO DE ESTADO → al reportante (asignada/en_proceso/en_espera/
--     resuelta/cerrada/cancelada según el destino; el evento 'asignada'
--     de estado lo emite el trigger de asignaciones con el técnico).
create or replace function public.notif_incidencia_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_de  text;
  v_a   text;
  v_evento text;
  v_ctx jsonb;
begin
  if new.usuario_reportante_id is null then
    return null;
  end if;
  if old.estado_id is not distinct from new.estado_id then
    return null;
  end if;

  select nombre into v_de  from public.estados_incidencia where id = old.estado_id;
  select nombre into v_a   from public.estados_incidencia where id = new.estado_id;

  v_evento := case v_a
    when 'En proceso' then 'en_proceso'
    when 'En espera'  then 'en_espera'
    when 'Resuelta'   then 'resuelta'
    when 'Cerrada'    then 'cerrada'
    when 'Cancelada'  then 'cancelada'
    else null
  end;
  if v_evento is null then
    return null; -- Asignada/Derivada/Pendiente: sus propios triggers
  end if;

  v_ctx := public.notif_contexto_incidencia(new.id);
  v_ctx := jsonb_set(v_ctx, '{detalle}',
    to_jsonb('estado ' || coalesce(v_de, '—') || ' → ' || v_a));

  perform public.notificar(
    new.usuario_reportante_id, v_evento, new.id,
    public.notif_reemplazar(
      (select asunto from public.plantillas_notificacion
        where evento = v_evento and activo and canal = 'interna' limit 1), v_ctx),
    public.notif_reemplazar(
      (select cuerpo from public.plantillas_notificacion
        where evento = v_evento and activo and canal = 'interna' limit 1), v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_incidencia_estado on public.incidencias;
create trigger trg_notif_incidencia_estado
  after update of estado_id on public.incidencias
  for each row execute function public.notif_incidencia_estado();

-- 4c. ASIGNACIÓN → al técnico asignado (evento 'asignada')
create or replace function public.notif_asignacion_creada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil_tecnico uuid;
  v_ctx jsonb;
begin
  select t.perfil_id into v_perfil_tecnico
  from public.tecnicos t
  where t.id = new.tecnico_id;
  if v_perfil_tecnico is null then
    return null;
  end if;

  v_ctx := public.notif_contexto_incidencia(new.incidencia_id);

  perform public.notificar(
    v_perfil_tecnico, 'asignada', new.incidencia_id,
    public.notif_reemplazar(
      (select asunto from public.plantillas_notificacion
        where evento = 'asignada' and activo and canal = 'interna' limit 1), v_ctx),
    public.notif_reemplazar(
      (select cuerpo from public.plantillas_notificacion
        where evento = 'asignada' and activo and canal = 'interna' limit 1), v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_asignacion on public.incidencia_asignaciones;
create trigger trg_notif_asignacion
  after insert on public.incidencia_asignaciones
  for each row execute function public.notif_asignacion_creada();

-- 4d. DERIVACIÓN → al reportante (evento 'derivada'; incluye la derivación
--     INICIAL de la clasificación automática: el reportante sabe qué área
--     asumió su ticket)
create or replace function public.notif_derivacion_creada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reportante uuid;
  v_ctx jsonb;
begin
  select i.usuario_reportante_id into v_reportante
  from public.incidencias i
  where i.id = new.incidencia_id;
  if v_reportante is null then
    return null;
  end if;

  v_ctx := public.notif_contexto_incidencia(new.incidencia_id);
  v_ctx := jsonb_set(v_ctx, '{area}',
    to_jsonb(coalesce(
      (select ar.nombre from public.areas ar where ar.id = new.area_destino_id), '')));

  perform public.notificar(
    v_reportante, 'derivada', new.incidencia_id,
    public.notif_reemplazar(
      (select asunto from public.plantillas_notificacion
        where evento = 'derivada' and activo and canal = 'interna' limit 1), v_ctx),
    public.notif_reemplazar(
      (select cuerpo from public.plantillas_notificacion
        where evento = 'derivada' and activo and canal = 'interna' limit 1), v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_derivacion on public.incidencia_derivaciones;
create trigger trg_notif_derivacion
  after insert on public.incidencia_derivaciones
  for each row execute function public.notif_derivacion_creada();

-- 4e. COMENTARIO → al reportante (solo si NO es nota interna)
create or replace function public.notif_comentario_creado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reportante uuid;
  v_ctx jsonb;
begin
  if coalesce(new.es_interno, false) then
    return null; -- las notas internas no notifican al reportante [VI]
  end if;

  select i.usuario_reportante_id into v_reportante
  from public.incidencias i
  where i.id = new.incidencia_id;
  if v_reportante is null or v_reportante = new.autor_id then
    return null; -- anónimo o el propio autor
  end if;

  v_ctx := public.notif_contexto_incidencia(new.incidencia_id);

  perform public.notificar(
    v_reportante, 'comentario', new.incidencia_id,
    public.notif_reemplazar(
      (select asunto from public.plantillas_notificacion
        where evento = 'comentario' and activo and canal = 'interna' limit 1), v_ctx),
    public.notif_reemplazar(
      (select cuerpo from public.plantillas_notificacion
        where evento = 'comentario' and activo and canal = 'interna' limit 1), v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_comentario on public.incidencia_comentarios;
create trigger trg_notif_comentario
  after insert on public.incidencia_comentarios
  for each row execute function public.notif_comentario_creado();

-- ----------------------------------------------------------------------------
-- 5. ALERTAS SLA → técnicos con asignación activa (evento 'sla_alerta')
--    La llama el dashboard técnico/admin (una vez por sesión de página):
--    crea la notificación (dedupe) para asignaciones vencidas o en riesgo.
-- ----------------------------------------------------------------------------
create or replace function public.notificar_alertas_sla()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_alerta record;
begin
  -- Vencidas o en riesgo de asignaciones activas (RPC 0017).
  for v_alerta in
    select * from public.slas_asignadas_al_tecnico()
    where estado_resolucion in ('vencido', 'en_riesgo')
  loop
    if public.notificar(
      (select t.perfil_id from public.tecnicos t
        join public.incidencia_asignaciones ia on ia.tecnico_id = t.id
        where ia.incidencia_id = v_alerta.incidencia_id and ia.activa
        limit 1),
      'sla_alerta',
      v_alerta.incidencia_id
    ) is not null then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.notificar_alertas_sla() from public, anon;
grant execute on function public.notificar_alertas_sla() to authenticated;

comment on function public.notificar_alertas_sla() is
  'Crea notificaciones sla_alerta para asignaciones activas vencidas o en riesgo (dedupe). La invocan los dashboards; solo alerta al técnico asignado.';

-- ----------------------------------------------------------------------------
-- 6. RPC DE LECTURA PARA EL CENTRO DE NOTIFICACIONES
-- ----------------------------------------------------------------------------
create or replace function public.mis_notificaciones(
  p_solo_no_leidas boolean default false,
  p_limite integer default 50
)
returns table (
  id          uuid,
  titulo      text,
  cuerpo      text,
  leida_en    timestamptz,
  creado_en   timestamptz,
  codigo_incidencia text,
  estado_incidencia text
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.titulo, n.cuerpo, n.leida_en, n.creado_en,
         i.codigo, e.nombre
  from public.notificaciones n
  left join public.incidencias i on i.id = n.incidencia_id
  left join public.estados_incidencia e on e.id = i.estado_id
  where n.perfil_id = auth.uid()
    and (not p_solo_no_leidas or n.leida_en is null)
  order by n.creado_en desc
  limit greatest(1, least(coalesce(p_limite, 50), 100));
$$;

revoke all on function public.mis_notificaciones(boolean, integer) from public, anon;
grant execute on function public.mis_notificaciones(boolean, integer) to authenticated;

create or replace function public.notificaciones_no_leidas()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notificaciones
  where perfil_id = auth.uid() and leida_en is null;
$$;

revoke all on function public.notificaciones_no_leidas() from public, anon;
grant execute on function public.notificaciones_no_leidas() to authenticated;

comment on function public.mis_notificaciones(boolean, integer) is
  'Bandeja del usuario autenticado (RLS 0007 replicada): título, cuerpo, lectura y código/estado de la incidencia enlazada.';
comment on function public.notificaciones_no_leidas() is
  'Contador de notificaciones no leídas del usuario autenticado (badge).';

-- ----------------------------------------------------------------------------
-- 7. REALTIME: publicar `notificaciones` (postgres_changes aplica RLS por
--    suscriptor → cada usuario recibe SOLO sus filas). Las tablas operativas
--    NO se publican (los datos de incidencias no salen por el canal).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication p
    join pg_publication_tables pt on pt.pubname = p.pubname
    where p.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename  = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 8. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('notificar','usuario_quiere_evento','crear_preferencias_notificacion',
       'notif_incidencia_creada','notif_incidencia_estado','notif_asignacion_creada',
       'notif_derivacion_creada','notif_comentario_creado','notificar_alertas_sla',
       'mis_notificaciones','notificaciones_no_leidas')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('notificar','usuario_quiere_evento','crear_preferencias_notificacion',
       'notif_incidencia_creada','notif_incidencia_estado','notif_asignacion_creada',
       'notif_derivacion_creada','notif_comentario_creado','notificar_alertas_sla',
       'mis_notificaciones','notificaciones_no_leidas')
  ) <> 11 then
    raise exception 'RPCs de notificaciones no creadas correctamente';
  end if;
end $$;
