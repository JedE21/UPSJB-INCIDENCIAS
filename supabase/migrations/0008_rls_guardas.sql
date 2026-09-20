-- ============================================================================
-- SIR-UPSJB · 0008_rls_guardas.sql
-- Guardas de integridad complementarias a RLS (defensa en profundidad):
--   1. Columnas inmutables de incidencias (codigo, reportante, creado_en)
--      para peticiones que llegan por la API (roles anon/authenticated).
--      El backend privilegiado (service_role / postgres) no queda afectado.
--   2. Corrección de policy de comentarios: las notas internas (es_interno)
--      NO son visibles al reportante; sí al técnico asignado y al admin.
--   3. Derivaciones: al abrir una derivación activa se cierra la anterior
--      (Regla 6 del modelo — el destino vigente es la fila abierta).
--   4. Adjuntos: el path en Storage debe referenciar la incidencia del
--      adjunto y usar el bucket privado 'evidencias' (§2.5 del modelo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Incidencias: inmutabilidad de columnas críticas ante clientes de API.
--    current_user dentro del trigger es el rol de conexión: 'authenticated'
--    (o 'anon') en peticiones de la app; 'postgres'/'service_role' en el
--    servidor → la guarda solo aplica al primero.
-- ----------------------------------------------------------------------------
create or replace function public.guarda_incidencias_inmutables()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.codigo is distinct from old.codigo then
      raise exception 'SIR-UPSJB: el codigo de la incidencia es inmutable';
    end if;
    if new.usuario_reportante_id is distinct from old.usuario_reportante_id then
      raise exception 'SIR-UPSJB: el reportante de la incidencia es inmutable';
    end if;
    if new.creado_en is distinct from old.creado_en then
      raise exception 'SIR-UPSJB: creado_en es inmutable';
    end if;
    if new.ambiente_id is distinct from old.ambiente_id then
      raise exception 'SIR-UPSJB: la ubicacion de la incidencia es inmutable (derivar o anular, no reubicar)';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_incidencias_guarda_inmutables
  before update on public.incidencias
  for each row execute function public.guarda_incidencias_inmutables();

-- ----------------------------------------------------------------------------
-- 2. Comentarios: notas internas ocultas al reportante.
--    (Reemplaza p_comentarios_select de 0007; la política de INSERT no cambia.)
-- ----------------------------------------------------------------------------
drop policy if exists p_comentarios_select on public.incidencia_comentarios;

create policy p_comentarios_select on public.incidencia_comentarios
  for select to authenticated
  using (
    -- autor o admin: ven todo
    autor_id = public.usuario_actual()
    or public.soy_administrador()
    -- técnico de la incidencia: ve también las internas
    or public.tengo_asignacion_activa(incidencia_id)
    -- reportante: solo las NO internas
    or (
      public.es_dueno_incidencia(incidencia_id)
      and not es_interno
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Derivaciones: cerrar la derivación activa anterior (Regla 6).
--    BEFORE INSERT: evita chocar con el índice parcial uq_derivacion_activa.
-- ----------------------------------------------------------------------------
create or replace function public.cerrar_derivacion_anterior()
returns trigger
language plpgsql
as $$
begin
  if new.activa then
    update public.incidencia_derivaciones
       set activa = false
     where incidencia_id = new.incidencia_id
       and activa
       and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger trg_derivaciones_cerrar_anterior
  before insert on public.incidencia_derivaciones
  for each row execute function public.cerrar_derivacion_anterior();

-- ----------------------------------------------------------------------------
-- 4. Adjuntos: bucket privado y path referenciando la incidencia (§2.5).
--    Evita que un cliente apunte evidencias a tickets ajenos por path.
-- ----------------------------------------------------------------------------
create or replace function public.guarda_adjuntos_path()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.bucket <> 'evidencias' then
      raise exception 'SIR-UPSJB: bucket de evidencias no permitido';
    end if;
    if position(new.incidencia_id::text in new.path) = 0 then
      raise exception 'SIR-UPSJB: el path debe referenciar la incidencia del adjunto';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_adjuntos_guarda_path
  before insert or update on public.incidencia_adjuntos
  for each row execute function public.guarda_adjuntos_path();

-- ----------------------------------------------------------------------------
-- Verificación: las guardas deben existir.
-- ----------------------------------------------------------------------------
do $$
declare
  faltan int;
begin
  select count(*) into faltan
  from (values
    ('incidencias',             'trg_incidencias_guarda_inmutables'),
    ('incidencia_derivaciones', 'trg_derivaciones_cerrar_anterior'),
    ('incidencia_adjuntos',     'trg_adjuntos_guarda_path')
  ) as esperados(tabla, trigger)
  where not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = esperados.trigger
      and not t.tgisinternal
      and (n.nspname || '.' || c.relname) =
          (case when position('.' in esperados.tabla) > 0
                then esperados.tabla else 'public.' || esperados.tabla end)
  );
  if faltan > 0 then
    raise exception 'Faltan % guardas tras la migracion', faltan;
  end if;
end
$$;
