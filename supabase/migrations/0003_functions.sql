-- ============================================================================
-- SIR-UPSJB · 0003_functions.sql
-- Funciones SQL requeridas por el modelo aprobado (docs/01 §8 y §10):
--   1. set_updated_at            — mantiene actualizado_en (§1, auditoría de fila).
--   2. set_default_by_name       — resuelve defaults por NOMBRE (sin UUID fijos).
--   3. resolver_secuencia_incidencias — secuencia ANUAL del código de incidencia (§2.2).
--   4. generar_codigo_incidencia — INC-<AAAA>-<NNNNNN> atómico por secuencia (D5).
--   5. generar_siguiente_codigo_qr — <SEDE>-<PABELLON>-<AMBIENTE>-<N> (§2.3).
--   6. generar_codigo_qr_nuevo / deshabilitar_qr_anterior — estructura QR (Regla 9).
--   7. cerrar_asignacion_anterior — a lo sumo un técnico activo por incidencia (D7).
--   8. sincronizar_movimientos_equipo — consistencia equipos_ambientes ↔ movimientos (R3).
--   9. register_new_user         — crea perfiles al registrarse (1:1 con auth.users, D2).
--
-- Sin credenciales ni secretos. SECURITY DEFINER solo donde es imprescindible
-- (defaults, códigos y registro de usuarios), siempre con search_path vacío.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Mantener actualizado_en en cada UPDATE
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Resolución de defaults por nombre de fila (sin UUID hardcodeados)
--    Tablas de catálogo pequeñas y con nombre UNIQUE: SELECT por nombre es
--    determinista y no rompe la portabilidad entre entornos (import/export).
-- ----------------------------------------------------------------------------
create or replace function public.set_default_by_name(
  p_tabla   text,
  p_columna text,
  p_nombre  text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sql  text;
  v_id   uuid;
begin
  -- Los identificadores provienen SOLO de llamadas internas del trigger
  -- (literal constante), nunca de entrada de usuarios.
  v_sql := format(
    'select id from public.%I where nombre = $1 limit 1',
    p_tabla
  );
  execute v_sql into v_id using p_nombre;
  if v_id is null then
    raise exception
      'set_default_by_name: no existe la fila "%" en public.% (¿falta el seed 0005?)',
      p_nombre, p_tabla;
  end if;
  return v_id;
end;
$$;

-- Defaults del modelo aplicados en INSERT (§6.5):
--   prioridad = Media [P] · estado = Pendiente · canal = QR
create or replace function public.asignar_defaults_incidencia()
returns trigger
language plpgsql
as $$
begin
  if new.prioridad_id is null then
    new.prioridad_id := public.set_default_by_name('prioridades', 'prioridad_id', 'Media');
  end if;
  if new.estado_id is null then
    new.estado_id := public.set_default_by_name('estados_incidencia', 'estado_id', 'Pendiente');
  end if;
  if new.canal_reporte_id is null then
    new.canal_reporte_id := public.set_default_by_name('canales_reporte', 'canal_reporte_id', 'QR');
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Secuencia ANUAL del código de incidencia (§2.2, D5)
--    Al pasar de año se crea incidencias_codigo_seq_<AAAA> (solo la primera
--    vez: sin escaneo de incidencias en cada INSERT). En su creación se
--    sincroniza con los códigos ya emitidos (restauración/importación).
-- ----------------------------------------------------------------------------
create or replace function public.resolver_secuencia_incidencias()
returns regclass
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio      int;
  v_secuencia text;
  v_reg       text;
  v_ultimo    int;
begin
  v_anio      := extract(year from now())::int;
  v_secuencia := format('incidencias_codigo_seq_%s', v_anio);

  select to_regclass(format('public.%I', v_secuencia))::text into v_reg;

  if v_reg is null then
    execute format('create sequence if not exists public.%I', v_secuencia);

    -- Si ya existen códigos del año (p. ej. base restaurada/importada),
    -- alinea la secuencia para no reemitir números. Se hace una sola vez.
    select coalesce(max(substring(codigo from '[0-9]+$')::int), 0)
      into v_ultimo
      from public.incidencias
     where codigo like format('INC-%s-%%', v_anio);

    perform setval(
      format('public.%I', v_secuencia),
      greatest(v_ultimo, 1),
      v_ultimo > 0
    );
  end if;

  return format('public.%I', v_secuencia)::regclass;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Código único de incidencia: INC-<AAAA>-<NNNNNN> (Regla 1)
--    nextval() dentro del INSERT = atómico bajo concurrencia (nunca max()+1).
-- ----------------------------------------------------------------------------
create or replace function public.generar_codigo_incidencia()
returns trigger
language plpgsql
as $$
declare
  v_secuencia regclass;
begin
  if new.codigo is not null then
    return new;  -- se permite explícito solo para importaciones/restauraciones
  end if;

  v_secuencia := public.resolver_secuencia_incidencias();

  new.codigo := format(
    'INC-%s-%s',
    extract(year from now())::int,
    lpad(nextval(v_secuencia)::text, 6, '0')
  );
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Código de QR: <SEDE>-<PABELLON>-<AMBIENTE>-<N> (§2.3). Ej.: ICA-B-B104-0001.
--    Se deriva del codigo del ambiente (<SEDE>-<PABELLON>-<AMBIENTE>, que ya
--    incluye el prefijo de sede, §2.4) + consecutivo de secuencia. La UNIQUE
--    de codigos_qr.codigo rechaza cualquier colision.
-- ----------------------------------------------------------------------------
create or replace function public.generar_siguiente_codigo_qr(
  p_ambiente_codigo text
)
returns text
language plpgsql
volatile
as $$
begin
  return p_ambiente_codigo
         || '-'
         || lpad(nextval('public.sec_codigos_qr')::text, 4, '0');
end;
$$;

-- Genera el codigo y la URL estable /r/<codigo> al insertar un QR.
create or replace function public.generar_codigo_qr_nuevo()
returns trigger
language plpgsql
as $$
declare
  v_ambiente_codigo text;
begin
  if new.codigo is not null then
    return new;  -- importación/manual: no recalcular
  end if;

  select a.codigo
    into v_ambiente_codigo
    from public.ambientes a
   where a.id = new.ambiente_id;

  if v_ambiente_codigo is null then
    raise exception 'generar_codigo_qr_nuevo: ambiente % inexistente', new.ambiente_id;
  end if;

  new.codigo      := public.generar_siguiente_codigo_qr(v_ambiente_codigo);
  new.url_destino := '/r/' || new.codigo;
  return new;
end;
$$;

-- Regla 9: al regenerar, deshabilita el QR activo anterior del ambiente.
create or replace function public.deshabilitar_qr_anterior()
returns trigger
language plpgsql
as $$
begin
  update public.codigos_qr
     set activo           = false,
         deshabilitado_en = now()
   where ambiente_id = new.ambiente_id
     and activo
     and id <> new.id;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Asignaciones: a lo sumo un técnico activo por incidencia (§8.6, D7).
--    Al abrir una asignación activa, cierra la anterior del mismo ticket.
--    La unicidad estricta la impone uq_asignacion_activa (0002); este trigger
--    evita el error cerrando la fila previa (la reasignación es flujo normal).
-- ----------------------------------------------------------------------------
create or replace function public.cerrar_asignacion_anterior()
returns trigger
language plpgsql
as $$
begin
  if new.activa then
    update public.incidencia_asignaciones
       set activa     = false,
           cerrada_en = now()
     where incidencia_id = new.incidencia_id
       and activa
       and id <> new.id;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Consistencia asignación vigente ↔ movimientos (R3, D8):
--    reubicar un equipo cierra su movimiento abierto y abre el nuevo;
--    además fuerza la unicidad de la asignación activa.
-- ----------------------------------------------------------------------------
create or replace function public.sincronizar_movimientos_equipo()
returns trigger
language plpgsql
as $$
declare
  v_actual          uuid;
  v_ambiente_actual uuid;
begin
  if new.activa then
    -- Cierra otra asignación activa del mismo equipo (ubicación actual única).
    update public.equipos_ambientes
       set activa = false
     where equipo_id = new.equipo_id
       and ambiente_id <> new.ambiente_id
       and activa;

    -- Cierra el movimiento abierto previo (si existe) y recuerda su destino:
    -- es el ambiente de origen del nuevo movimiento.
    select id, ambiente_destino_id
      into v_actual, v_ambiente_actual
      from public.movimientos_equipos
     where equipo_id = new.equipo_id
       and fecha_hasta is null
     order by fecha_desde desc
     limit 1;

    if v_actual is not null then
      update public.movimientos_equipos
         set fecha_hasta = now()
       where id = v_actual;
    end if;

    -- Abre el movimiento hacia la nueva ubicación (si no existe ya abierto).
    if not exists (
      select 1 from public.movimientos_equipos
       where equipo_id = new.equipo_id
         and ambiente_destino_id = new.ambiente_id
         and fecha_hasta is null
    ) then
      insert into public.movimientos_equipos
        (equipo_id, ambiente_origen_id, ambiente_destino_id, tipo_movimiento)
      values
        (new.equipo_id, v_ambiente_actual, new.ambiente_id, 'asignacion');
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Alta automática de perfiles al registrarse en Supabase Auth (D2).
--    SECURITY DEFINER: el nuevo usuario aún no tiene fila en perfiles.
--    Crea la fila 1:1 (mismo UUID) y asigna el rol base ESTUDIANTE [P].
--    NOTA: los nombres de raw_user_meta_data (nombres, apellido_paterno) se
--    definirán en la fase de autenticación (supabase-js signUp options.data).
-- ----------------------------------------------------------------------------
create or replace function public.register_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol uuid;
begin
  insert into public.perfiles (id, correo, nombres, apellido_paterno)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombres', ''), 'Pendiente'),
    coalesce(nullif(new.raw_user_meta_data ->> 'apellido_paterno', ''), '')
  );

  select id into v_rol
    from public.roles
   where nombre = 'ESTUDIANTE';

  if v_rol is not null then
    insert into public.usuarios_roles (perfil_id, rol_id)
    values (new.id, v_rol)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
