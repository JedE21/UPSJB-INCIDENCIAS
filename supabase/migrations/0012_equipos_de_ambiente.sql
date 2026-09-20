-- ============================================================================
-- SIR-UPSJB · 0012_equipos_de_ambiente.sql
-- RPC SECURITY DEFINER para el equipo relacionado opcional del reporte.
--
-- CONTEXTO: la RLS aprobada (0007, p_equipos_lectura / p_equipos_amb_lectura)
-- solo permite leer `equipos`/`equipos_ambientes` a técnico/coordinador/admin.
-- El reportante de una incidencia necesita elegir (OPCIONALMENTE) el equipo
-- del ambiente en su reporte (Plan Maestro §28/§49; tabla incidencia_equipos).
--
-- SOLUCIÓN (mismo patrón que 0011): función SECURITY DEFINER con search_path
-- vacío que expone SOLO los equipos ACTIVOS asignados a UN ambiente dado:
--   · equipos_de_ambiente(ambiente_id) → id, código interno, categoría.
-- Sin UUIDs de catálogos internos, sin series, sin estados de inventario.
-- La validación del par (incidencia, equipo) al crear la incidencia la hace
-- la Server Action + RLS de incidencia_equipos (dueño o técnico).
-- ============================================================================

create or replace function public.equipos_de_ambiente(p_ambiente_id uuid)
returns table (
  equipo_id      uuid,
  codigo_interno text,
  categoria      text
)
language sql
security definer
set search_path = ''
stable
as $$
  select e.id,
         e.codigo_interno,
         ce.nombre
  from public.equipos_ambientes ea
  join public.equipos e
    on e.id = ea.equipo_id
   and e.activo
  join public.categorias_equipos ce
    on ce.id = e.categoria_id
  where ea.ambiente_id = p_ambiente_id
    and ea.activa
  order by e.codigo_interno;
$$;

revoke all on function public.equipos_de_ambiente(uuid) from public;
grant execute on function public.equipos_de_ambiente(uuid) to authenticated;

comment on function public.equipos_de_ambiente(uuid) is
  'Reporte: equipos activos del ambiente (mínimos datos; RLS 0007 intacta).';
