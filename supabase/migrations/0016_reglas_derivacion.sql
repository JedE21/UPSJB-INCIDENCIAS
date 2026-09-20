-- ============================================================================
-- SIR-UPSJB · 0016_reglas_derivacion.sql
-- FASE 8 (Plan Maestro §18, §36, §40): reglas de clasificación y derivación.
--
-- La LÓGICA vive en la BD (RPC SECURITY DEFINER con revalidación completa);
-- la UI solo oculta botones. Las reglas son CONFIGURABLES: la tabla
-- reglas_enrutamiento (0001) es la fuente de verdad y el administrador las
-- gestiona desde el panel (policy p_reglas_admin de 0007); NINGÚN caso de
-- ejemplo está hardcodeado en las funciones.
--
-- FLUJO (§6): crear → clasificación → evaluación de reglas → área/servicio
--             → asignación o derivación → atención.
--
-- PIEZAS:
--   1. evaluar_reglas_enrutamiento(p_tipo, p_subtipo)
--      → la PRIMERA regla activa que coincida, ordenada por prioridad_orden;
--        una regla con subtipo específico pisa a la del tipo completo porque
--        el admin le asigna un prioridad_orden menor (índice uq_reglas_orden).
--        Sin coincidencia devuelve NULL (sin derivación inicial: el ticket
--        queda Pendiente para gestión manual del coordinador).
--   2. clasificar_incidencia(p_incidencia_id, p_origen)
--      → evalúa reglas para la incidencia; si hay coincidencia crea la
--        derivación inicial (área/servicio destino, motivo con nombre de la
--        regla), aplica prioridad_defecto si existe y cambia Pendiente→Derivada.
--        Devuelve la derivación creada o NULL (sin regla). Registra auditoría
--        de la regla aplicada y deja evento en el historial (trigger 0013).
--   3. derivar_incidencia(p_incidencia, p_area, p_servicio, p_motivo)
--      → derivación MANUAL autorizada: ADMINISTRADOR, COORDINADOR del área
--        destino vigente, o quien tenga permiso derivar_incidencia. Valida
--        área/servicio activos, servicio ∈ área, no auto-derivarse (CHECK BD),
--        y cambia el estado a Derivada (estado existente, semilla 0005).
--   4. asignar_incidencia(p_incidencia, p_tecnico)
--      → asignación MANUAL: ADMINISTRADOR o COORDINADOR del área vigente con
--        permiso asignar_incidencia. Valida técnico activo del área destino
--        vigente. El trigger 0013 deja el evento ASIGNAR en el historial.
--   5. auditoria_regla_enrutamiento()
--      → trigger AFTER INSERT/UPDATE/DELETE sobre reglas_enrutamiento:
--        escribe en registros_auditoria (MODIFICAR_CONFIGURACION, append-only)
--        con valores_previos/valores_nuevos. Solo para clientes de la API
--        (definer del sistema no duplica eventos de las semillas).
--   6. derivacion_activa_de_incidencia(p_incidencia_id)
--      → lectura del destino vigente para la UI (RPC, evita consultar la
--        tabla directamente con policies de subconsulta).
--
-- La auditoría global de la clasificación usa registros_auditoria (CHECK:
-- MODIFICAR_CONFIGURACION/ASIGNAR/DERIVAR/CAMBIAR_ESTADO existentes en 0001).
-- El historial append-only de la incidencia lo alimentan los triggers 0013
-- (DERIVAR/ASIGNAR/CAMBIAR_ESTADO) y los eventos detallados de estas RPCs.
--
-- Sin service_role: todo pasa por authenticated + RLS (0007/0009).
-- Idempotente y re-ejecutable (create or replace / drop if exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper: ¿el estado existe en el catálogo? (no se inventan estados)
-- ----------------------------------------------------------------------------
create or replace function public.estado_id_por_nombre(p_nombre text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.estados_incidencia where nombre = p_nombre and activo limit 1;
$$;

revoke all on function public.estado_id_por_nombre(text) from public, anon;
grant execute on function public.estado_id_por_nombre(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 1. EVALUACIÓN DE REGLAS (pura: la misma lógica sirve para vista previa)
-- ----------------------------------------------------------------------------
create or replace function public.evaluar_reglas_enrutamiento(
  p_tipo_id    uuid,
  p_subtipo_id uuid
)
returns table (
  regla_id             uuid,
  regla_nombre         text,
  area_destino_id      uuid,
  area_destino_nombre  text,
  servicio_destino_id  uuid,
  servicio_destino_nombre text,
  prioridad_defecto_id uuid,
  prioridad_orden      integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         r.nombre,
         r.area_destino_id,
         ar.nombre,
         r.servicio_destino_id,
         sv.nombre,
         r.prioridad_defecto_id,
         r.prioridad_orden
  from public.reglas_enrutamiento r
  join public.areas ar        on ar.id = r.area_destino_id
  left join public.servicios sv on sv.id = r.servicio_destino_id
  where r.activa
    and r.area_destino_id in (select a.id from public.areas a where a.activo)
    and (r.servicio_destino_id is null
         or r.servicio_destino_id in (select s.id from public.servicios s where s.activo))
    and r.tipo_incidencia_id = p_tipo_id
    -- Coincidencia: regla del subtipo específico, o regla "todo el tipo"
    -- (subtipo NULL). Un reporte SIN subtipo solo matchea reglas de tipo.
    and (r.subtipo_incidencia_id is null or r.subtipo_incidencia_id = p_subtipo_id)
  order by
    -- La regla del SUBTIPO específico evalúa primero cuando el reporte lo trae;
    -- el desempate entre reglas del mismo alcance lo decide prioridad_orden.
    case when p_subtipo_id is not null and r.subtipo_incidencia_id = p_subtipo_id then 0 else 1 end,
    r.prioridad_orden
  limit 1;
$$;

revoke all on function public.evaluar_reglas_enrutamiento(uuid, uuid) from public, anon;
grant execute on function public.evaluar_reglas_enrutamiento(uuid, uuid) to authenticated;

comment on function public.evaluar_reglas_enrutamiento(uuid, uuid) is
  'Clasificación (§36): primera regla activa que coincide (tipo+subtipo), ordenada por prioridad_orden. Regla con subtipo pisa a la del tipo. Sin coincidencia → NULL.';

-- ----------------------------------------------------------------------------
-- 2. CLASIFICAR (llamar justo después de crear la incidencia)
--    Crea la derivación INICIAL (area_origen NULL) con el motivo/nombre de la
--    regla aplicada, aplica prioridad por defecto de la regla y mueve el
--    estado Pendiente → Derivada. Sin regla: no hace nada (devuelve NULL) y
--    el ticket sigue Pendiente para gestión manual.
-- ----------------------------------------------------------------------------
create or replace function public.clasificar_incidencia(
  p_incidencia_id uuid,
  p_origen        text default 'automatica'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo    uuid;
  v_subtipo uuid;
  v_estado  text;
  v_regla   record;
  v_derivacion uuid;
  v_prioridad_nueva uuid;
  v_prioridad_anterior text;
  v_actor uuid := auth.uid();
begin
  select i.tipo_incidencia_id, i.subtipo_incidencia_id,
         (select e.nombre from public.estados_incidencia e where e.id = i.estado_id)
    into v_tipo, v_subtipo, v_estado
  from public.incidencias i
  where i.id = p_incidencia_id;

  if v_tipo is null then
    raise exception 'Incidencia no encontrada';
  end if;

  -- La clasificación automática corre sobre tickets recién creados.
  if v_estado <> 'Pendiente' then
    raise exception 'Solo se clasifican incidencias en estado Pendiente (actual: %)', v_estado;
  end if;

  -- Evaluación de reglas configurables (única fuente de verdad).
  select * into v_regla
  from public.evaluar_reglas_enrutamiento(v_tipo, v_subtipo);

  if v_regla is null or v_regla.regla_id is null then
    -- AUSENCIA DE REGLA: no se fuerza destino; queda Pendiente para el
    -- coordinador. Se deja constancia para trazabilidad operativa.
    insert into public.registros_auditoria
      (actor_id, accion, tabla_afectada, registro_id, valores_nuevos)
    values
      (v_actor, 'MODIFICAR_CONFIGURACION', 'incidencias', p_incidencia_id,
       jsonb_build_object('clasificacion', 'sin_regla_coincidente', 'origen', p_origen));
    return null;
  end if;

  -- Derivación inicial (area_origen NULL = registro inicial; CHECK de BD exige
  -- destino distinto de origen → con origen NULL siempre pasa).
  insert into public.incidencia_derivaciones
    (incidencia_id, area_origen_id, area_destino_id, servicio_destino_id,
     motivo, activa, derivado_por)
  values
    (p_incidencia_id, null, v_regla.area_destino_id, v_regla.servicio_destino_id,
     'Clasificación automática — regla: ' || v_regla.regla_nombre
       || case when p_origen <> 'automatica' then ' (' || p_origen || ')' else '' end,
     true, v_actor)
  returning id into v_derivacion;

  -- Prioridad por defecto de la regla (configurable por el admin).
  if v_regla.prioridad_defecto_id is not null then
    select pr.nombre into v_prioridad_anterior
    from public.prioridades pr where pr.id =
      (select i2.prioridad_id from public.incidencias i2 where i2.id = p_incidencia_id);

    update public.incidencias
       set prioridad_id = v_regla.prioridad_defecto_id
     where id = p_incidencia_id;
  end if;

  -- Estado Derivada (existente en semilla 0005): el destino quedó definido.
  update public.incidencias
     set estado_id = public.estado_id_por_nombre('Derivada')
   where id = p_incidencia_id;

  -- Auditoría: regla aplicada y resultado (§40 MODIFICAR_CONFIGURACION/
  -- CLASIFICAR; usamos ASIGNAR = ruta operativa asignada por el sistema).
  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_previos, valores_nuevos)
  values
    (v_actor, 'ASIGNAR', 'reglas_enrutamiento', v_regla.regla_id,
     jsonb_build_object('regla', v_regla.regla_nombre),
     jsonb_build_object('incidencia', p_incidencia_id,
                        'area_destino', v_regla.area_destino_nombre,
                        'servicio_destino', v_regla.servicio_destino_nombre,
                        'prioridad_anterior', v_prioridad_anterior,
                        'origen', p_origen));

  return v_derivacion;
end;
$$;

revoke all on function public.clasificar_incidencia(uuid, text) from public, anon;
grant execute on function public.clasificar_incidencia(uuid, text) to authenticated;

comment on function public.clasificar_incidencia(uuid, text) is
  'Clasificación automática: aplica la primera regla coincidente → derivación inicial + prioridad por defecto + estado Derivada. Sin regla → NULL y queda Pendiente.';

-- ----------------------------------------------------------------------------
-- 3. DERIVACIÓN MANUAL AUTORIZADA
--    ADMINISTRADOR, COORDINADOR del área destino vigente, o usuario con el
--    permiso derivar_incidencia. Motivo obligatorio [VI]. No auto-derivarse
--    lo impone ck_incidencia_derivaciones_auto (BD).
-- ----------------------------------------------------------------------------
create or replace function public.derivar_incidencia(
  p_incidencia_id uuid,
  p_area_destino_id uuid,
  p_servicio_destino_id uuid default null,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_actual  text;
  v_area_actual_id uuid;
  v_estado_actual text;
  v_area_ok boolean;
  v_servicio_ok boolean;
  v_derivada uuid;
  v_estado_derivada uuid;
  v_actor uuid := auth.uid();
  v_autorizado boolean;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo de la derivación es obligatorio';
  end if;
  if btrim(p_motivo) > '' and char_length(btrim(p_motivo)) > 500 then
    raise exception 'El motivo no puede superar los 500 caracteres';
  end if;

  -- Datos vigentes de la incidencia.
  select (select ar.nombre from public.areas ar where ar.id = d.area_destino_id),
         d.area_destino_id,
         (select e.nombre from public.estados_incidencia e where e.id = i.estado_id)
    into v_area_actual, v_area_actual_id, v_estado_actual
  from public.incidencias i
  left join public.incidencia_derivaciones d
    on d.incidencia_id = i.id and d.activa
  where i.id = p_incidencia_id
  limit 1;

  if v_estado_actual is null then
    raise exception 'Incidencia no encontrada';
  end if;

  -- Autorización: admin, coordinador del área vigente, o permiso explícito.
  v_autorizado := public.soy_administrador()
    or public.tiene_permiso('derivar_incidencia')
    or (public.soy_coordinador() and public.soy_coordinador_de_area(v_area_actual_id));
  if not v_autorizado then
    raise exception 'No tienes autorización para derivar esta incidencia';
  end if;

  -- Estados finales: un ticket cerrado/cancelado/resuelto no se deriva.
  if v_estado_actual in ('Cerrada', 'Cancelada', 'Resuelta') then
    raise exception 'No se puede derivar una incidencia en estado %', v_estado_actual;
  end if;

  -- Área destino activa.
  select exists (
    select 1 from public.areas where id = p_area_destino_id and activo
  ) into v_area_ok;
  if not v_area_ok then
    raise exception 'El área de destino no existe o no está activa';
  end if;

  -- Servicio destino: activo y perteneciente al área destino.
  if p_servicio_destino_id is not null then
    select exists (
      select 1 from public.servicios
      where id = p_servicio_destino_id and area_id = p_area_destino_id and activo
    ) into v_servicio_ok;
    if not v_servicio_ok then
      raise exception 'El servicio indicado no pertenece al área de destino o no está activo';
    end if;
  end if;

  insert into public.incidencia_derivaciones
    (incidencia_id, area_origen_id, area_destino_id, servicio_destino_id,
     motivo, activa, derivado_por)
  values
    (p_incidencia_id, v_area_actual_id, p_area_destino_id, p_servicio_destino_id,
     'Derivación manual — ' || btrim(p_motivo), true, v_actor)
  returning id into v_derivada;

  -- Al derivar, la asignación del área anterior pierde vigencia: el trigger
  -- trg_asignaciones_cerrar_anterior (0003) exige una única activa y el nuevo
  -- área aún no tiene técnico. Si existía asignación activa se cierra.
  update public.incidencia_asignaciones
     set activa = false, cerrada_en = now()
   where incidencia_id = p_incidencia_id and activa;

  -- Estado → Derivada (solo si sigue dentro del flujo activo).
  v_estado_derivada := public.estado_id_por_nombre('Derivada');
  if v_estado_derivada is not null then
    update public.incidencias
       set estado_id = v_estado_derivada
     where id = p_incidencia_id;
  end if;

  -- Auditoría (DERIVAR, §40).
  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_previos, valores_nuevos)
  values
    (v_actor, 'DERIVAR', 'incidencia_derivaciones', v_derivada,
     jsonb_build_object('area_origen', v_area_actual),
     jsonb_build_object('area_destino_id', p_area_destino_id,
                        'servicio_destino_id', p_servicio_destino_id,
                        'motivo', left(btrim(p_motivo), 500)));

  return v_derivada;
end;
$$;

revoke all on function public.derivar_incidencia(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.derivar_incidencia(uuid, uuid, uuid, text) to authenticated;

comment on function public.derivar_incidencia(uuid, uuid, uuid, text) is
  'Derivación manual autorizada (admin/coordinador del área vigente/permiso derivar_incidencia): motivo obligatorio, cierra asignación previa, estado → Derivada, auditoría DERIVAR.';

-- ----------------------------------------------------------------------------
-- 4. ASIGNACIÓN MANUAL AUTORIZADA
--    ADMINISTRADOR o COORDINADOR del área destino vigente con permiso
--    asignar_incidencia. El técnico debe estar activo en el área destino.
-- ----------------------------------------------------------------------------
create or replace function public.asignar_incidencia(
  p_incidencia_id uuid,
  p_tecnico_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_destino uuid;
  v_estado_actual text;
  v_autorizado boolean;
  v_tecnico_ok boolean;
  v_actor uuid := auth.uid();
begin
  if p_tecnico_id is null then
    raise exception 'Indica el técnico a asignar';
  end if;

  select d.area_destino_id,
         (select e.nombre from public.estados_incidencia e where e.id = i.estado_id)
    into v_area_destino, v_estado_actual
  from public.incidencias i
  left join public.incidencia_derivaciones d
    on d.incidencia_id = i.id and d.activa
  where i.id = p_incidencia_id
  limit 1;

  if v_estado_actual is null then
    raise exception 'Incidencia no encontrada';
  end if;

  v_autorizado := public.soy_administrador()
    or (public.soy_coordinador()
        and public.soy_coordinador_de_area(v_area_destino)
        and public.tiene_permiso('asignar_incidencia'));
  if not v_autorizado then
    raise exception 'No tienes autorización para asignar técnicos en esta incidencia';
  end if;

  if v_estado_actual in ('Cerrada', 'Cancelada', 'Resuelta') then
    raise exception 'No se puede asignar una incidencia en estado %', v_estado_actual;
  end if;

  -- Técnico ACTIVO del área destino vigente (sin técnico = ticket sin dueño).
  select exists (
    select 1 from public.tecnicos
    where id = p_tecnico_id and activo and area_id = v_area_destino
  ) into v_tecnico_ok;
  if not v_tecnico_ok then
    raise exception 'El técnico no está activo en el área responsable de esta incidencia';
  end if;

  insert into public.incidencia_asignaciones
    (incidencia_id, tecnico_id, activa, asignado_por)
  values
    (p_incidencia_id, p_tecnico_id, true, v_actor);

  -- Estado → Asignada (solo desde Pendiente/Derivada; si ya está En proceso
  -- por reasignación, no retrocede).
  if v_estado_actual in ('Pendiente', 'Derivada') then
    update public.incidencias
       set estado_id = public.estado_id_por_nombre('Asignada')
     where id = p_incidencia_id;
  end if;

  -- Auditoría (ASIGNAR, §40). El evento de historial lo escribe el trigger
  -- trg_asignaciones_historial (0013) con el técnico y el actor.
  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_nuevos)
  values
    (v_actor, 'ASIGNAR', 'incidencia_asignaciones', p_incidencia_id,
     jsonb_build_object('tecnico_id', p_tecnico_id));

  return true;
end;
$$;

revoke all on function public.asignar_incidencia(uuid, uuid) from public, anon;
grant execute on function public.asignar_incidencia(uuid, uuid) to authenticated;

comment on function public.asignar_incidencia(uuid, uuid) is
  'Asignación manual (admin o coordinador del área vigente con asignar_incidencia): técnico activo del área destino; estado → Asignada; auditoría + historial (trigger 0013).';

-- ----------------------------------------------------------------------------
-- 5. AUDITORÍA DE REGLAS (§40: cambios de configuración trazables)
--    AFTER INSERT/UPDATE/DELETE para clientes de la API; append-only
--    registros_auditoria (bloquear_update_delete, 0004).
-- ----------------------------------------------------------------------------
create or replace function public.auditoria_regla_enrutamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resumen jsonb;
begin
  v_resumen := jsonb_build_object(
    'nombre', case when tg_op = 'DELETE' then null else new.nombre end,
    'activa', case when tg_op = 'DELETE' then null else new.activa end,
    'orden',  case when tg_op = 'DELETE' then null else new.prioridad_orden end,
    'regla_id', case when tg_op = 'DELETE' then old.id else new.id end
  );

  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_previos, valores_nuevos)
  values
    (auth.uid(), 'MODIFICAR_CONFIGURACION', 'reglas_enrutamiento',
     case when tg_op = 'DELETE' then old.id else new.id end,
     case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
     case when tg_op = 'DELETE' then null else v_resumen end);
  return null;
end;
$$;

-- Solo dispara para clientes de la API (anon/authenticated): el trigger
-- comprueba el rol de conexión, igual que las guardas de 0008.
create or replace function public.auditoria_regla_enrutamiento_guarda()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    perform public.auditoria_regla_enrutamiento();
  end if;
  return null;
end;
$$;

drop trigger if exists trg_reglas_auditoria on public.reglas_enrutamiento;
create trigger trg_reglas_auditoria
  after insert or update or delete on public.reglas_enrutamiento
  for each row execute function public.auditoria_regla_enrutamiento_guarda();

-- ----------------------------------------------------------------------------
-- 6. LECTURA del destino vigente (para la UI; misma info que el seguimiento)
-- ----------------------------------------------------------------------------
create or replace function public.derivacion_activa_de_incidencia(p_incidencia_id uuid)
returns table (
  derivacion_id uuid,
  area_destino_id uuid,
  area_destino_nombre text,
  servicio_destino_id uuid,
  servicio_destino_nombre text,
  motivo text,
  derivado_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.area_destino_id, ar.nombre,
         d.servicio_destino_id, sv.nombre,
         d.motivo, d.derivado_en
  from public.incidencia_derivaciones d
  join public.areas ar      on ar.id = d.area_destino_id
  left join public.servicios sv on sv.id = d.servicio_destino_id
  where d.incidencia_id = p_incidencia_id
    and d.activa
  limit 1;
$$;

revoke all on function public.derivacion_activa_de_incidencia(uuid) from public, anon;
grant execute on function public.derivacion_activa_de_incidencia(uuid) to authenticated;

comment on function public.derivacion_activa_de_incidencia(uuid) is
  'Destino vigente (área/servicio responsable) de una incidencia, con motivo y fecha.';

-- ----------------------------------------------------------------------------
-- 7. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('evaluar_reglas_enrutamiento','clasificar_incidencia','derivar_incidencia',
       'asignar_incidencia','auditoria_regla_enrutamiento','derivacion_activa_de_incidencia',
       'estado_id_por_nombre')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('evaluar_reglas_enrutamiento','clasificar_incidencia','derivar_incidencia',
       'asignar_incidencia','auditoria_regla_enrutamiento','derivacion_activa_de_incidencia',
       'estado_id_por_nombre')
  ) <> 7 then
    raise exception 'RPCs del módulo de reglas y derivación no creadas correctamente';
  end if;
end $$;
