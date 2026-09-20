-- ============================================================================
-- SIR-UPSJB · 0015_admin_catalogos_completos.sql
-- Objetivo: completar la administración de infraestructura, equipos y
-- organización desde el panel admin SIN cambiar el modelo aprobado (58 tablas).
--
-- Añade SOLO dos restricciones UNIQUE que el modelo implicaba pero que 0001
-- no declaró explícitamente (el resto de unicidades ya existen):
--   · modelos_equipos.marca_id + nombre  (evita modelos duplicados por marca)
--   · tecnicos.perfil_id                 (1:0..1 técnico ↔ perfil, ya citada
--     en 0001 como uq_tecnicos_perfil; se re-declara idempotente por si la
--     base se restauró sin ella)
--
-- Idempotente: DO $$ comprueba pg_constraint antes de cada ALTER.
-- No se crean datos institucionales: sin sedes/ambientes/equipos reales.
-- ============================================================================

-- uq_modelos_equipos_marca_nombre --------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_modelos_equipos_marca_nombre'
      and conrelid = 'public.modelos_equipos'::regclass
  ) then
    alter table public.modelos_equipos
      add constraint uq_modelos_equipos_marca_nombre
      unique (marca_id, nombre);
  end if;
end
$$;

-- uq_tecnicos_perfil (re-declaración idempotente de la regla 1:0..1) ---------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_tecnicos_perfil'
      and conrelid = 'public.tecnicos'::regclass
  ) then
    alter table public.tecnicos
      add constraint uq_tecnicos_perfil unique (perfil_id);
  end if;
end
$$;

-- Verificación: ambas restricciones deben existir al terminar.
do $$
declare
  faltan int;
begin
  select count(*) into faltan
  from (values
    ('uq_modelos_equipos_marca_nombre', 'modelos_equipos'),
    ('uq_tecnicos_perfil',              'tecnicos')
  ) as esperados(constraint_name, tabla)
  where not exists (
    select 1 from pg_constraint c
    where c.conname = esperados.constraint_name
      and c.conrelid = format('public.%I', esperados.tabla)::regclass
  );
  if faltan > 0 then
    raise exception 'Faltan % constraints UNIQUE tras la migracion 0015', faltan;
  end if;
end
$$;
