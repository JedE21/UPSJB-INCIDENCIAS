-- ============================================================================
-- SIR-UPSJB · 0007_rls_politicas.sql
-- Row Level Security — 58 tablas + tabla de apoyo private.tecnico_area_admin.
--
-- Modelo de acceso (reglas del usuario):
--   ESTUDIANTE / DOCENTE / ADMINISTRATIVO → crear y ver SOLO sus incidencias;
--     seguimiento permitido = historial/comentarios/adjuntos de SUS tickets.
--   TECNICO  → incidencias de su área (visibilidad) y acciones sobre las que
--     tiene asignación activa (acciones, evidencias, resolver).
--   COORDINADOR → supervisa SU área; asigna, deriva, ajusta prioridad.
--   ADMINISTRADOR → acceso administrativo total (configura catálogos).
--   SUPERVISOR → solo lectura de tickets [VI] (con permiso ver_reportes).
--   anon → nada (el seguimiento público por código se hará con RPC segura).
--
-- NOTAS DE DISEÑO:
--   · Se hace ENABLE row level security SIN FORCE: las funciones auxiliares
--     de 0006 son SECURITY DEFINER (dueño = postgres, dueño de las tablas);
--     con FORCE el dueño también pasaría por las policies y los helpers
--     (tiene_permiso, es_dueno_incidencia, ...) dejarían de ver sus propias
--     tablas de apoyo. Los roles de la app (anon/authenticated) SIEMPRE
--     pasan por las policies: el perímetro queda intacto.
--   · Las policies no admiten aliases de tabla: las columnas se referencian
--     sin alias y las referencias externas en subconsultas se califican con
--     el nombre de la tabla (p. ej. incidencias.id).
--   · No hay policy de DELETE sobre datos operativos: el borrado físico no
--     existe en el modelo (docs/01 §2.7).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Tabla de apoyo private (no expuesta por la API)
-- ----------------------------------------------------------------------------
revoke all on private.tecnico_area_admin from anon, authenticated;

-- El admin la gestiona...
create policy p_apoyo_admin on private.tecnico_area_admin
  for all to authenticated
  using (public.soy_administrador())
  with check (public.soy_administrador());

-- ...y cada usuario puede leer sus PROPIAS coberturas (lo exigen los helpers
-- soy_coordinador* evaluados desde policies del propio coordinador).
create policy p_apoyo_self on private.tecnico_area_admin
  for select to authenticated
  using (perfil_id = public.usuario_actual());

-- ----------------------------------------------------------------------------
-- 1. Activar RLS en TODAS las tablas del esquema public
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles','roles','permisos','roles_permisos','usuarios_roles',
    'sedes','pabellones','pisos','tipos_ambiente','ambientes','aulas',
    'laboratorios','ambientes_caracteristicas',
    'categorias_equipos','marcas_equipos','modelos_equipos','estados_equipos',
    'equipos','equipos_ambientes','movimientos_equipos',
    'codigos_qr','lecturas_qr',
    'tipos_incidencia','subtipos_incidencia','prioridades','estados_incidencia',
    'canales_reporte','incidencias',
    'incidencia_ubicaciones','incidencia_equipos','incidencia_adjuntos',
    'incidencia_comentarios','incidencia_historial','incidencia_asignaciones',
    'incidencia_derivaciones',
    'areas','servicios','tecnicos','especialidades_tecnicas',
    'tecnicos_especialidades','turnos','tecnicos_turnos',
    'reglas_enrutamiento',
    'acuerdos_nivel_servicio','tiempos_sla','feriados',
    'plantillas_notificacion','notificaciones','preferencias_notificacion',
    'dispositivos_usuario',
    'encuestas_cierre','respuestas_encuesta',
    'categorias_conocimiento','articulos_conocimiento',
    'sesiones_usuario','registros_auditoria',
    'reportes_generados','exportaciones'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 2. perfiles — cada usuario lee/edita SU fila; el admin gestiona todas.
--    (INSERT no existe para el cliente: la fila la crea register_new_user.)
-- ----------------------------------------------------------------------------
create policy p_perfiles_select on public.perfiles
  for select to authenticated
  using (id = public.usuario_actual() or public.soy_administrador());

create policy p_perfiles_update on public.perfiles
  for update to authenticated
  using (id = public.usuario_actual())
  with check (
    id = public.usuario_actual()
    -- blindaje: no puede cambiarse el estado de la cuenta propia
    and estado = (
      select p.estado from public.perfiles p where p.id = public.usuario_actual()
    )
  );

create policy p_perfiles_admin on public.perfiles
  for all to authenticated
  using (public.soy_administrador())
  with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 3. Seguridad (roles/permisos/asignaciones): lectura; escritura solo admin.
-- ----------------------------------------------------------------------------
create policy p_roles_lectura on public.roles
  for select to authenticated
  using (activo or public.soy_administrador());

create policy p_roles_admin on public.roles
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_permisos_lectura on public.permisos
  for select to authenticated
  using (true);

create policy p_permisos_admin on public.permisos
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_roles_permisos_lectura on public.roles_permisos
  for select to authenticated
  using (true);

create policy p_roles_permisos_admin on public.roles_permisos
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_usuarios_roles_select on public.usuarios_roles
  for select to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador());

create policy p_usuarios_roles_admin_alta on public.usuarios_roles
  for insert to authenticated
  with check (public.soy_administrador());

create policy p_usuarios_roles_admin_baja on public.usuarios_roles
  for delete to authenticated
  using (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 4. Incidencias — corazón del modelo.
--    SELECT (quién ve un ticket):
--      · su dueño (usuario_reportante_id = usuario_actual())
--      · cualquier técnico activo (visibilidad operativa del flujo)
--      · coordinador del área de destino vigente del ticket
--      · administrador; supervisor con permiso ver_reportes
--    INSERT: perfil activo + permiso crear_incidencia (cualquier rol).
--    UPDATE: por columnas, con 3 policies complementarias (OR):
--      · dueño → solo confirmar cierre de su ticket ya Resuelto
--        (fija descripcion/prioridad/ambiente sin cambios; puede poner
--         estado Cerrada/Cancelada, fecha_cierre y cerrado_por)
--      · técnico con asignación activa → flujo de atención
--      · coordinador del área vigente → prioridad/asignación/derivación
--    DELETE: nadie.
-- ----------------------------------------------------------------------------
create policy p_incidencias_insert on public.incidencias
  for insert to authenticated
  with check (public.perfil_activo() and public.tiene_permiso('crear_incidencia'));

create policy p_incidencias_select on public.incidencias
  for select to authenticated
  using (
    usuario_reportante_id = public.usuario_actual()
    or public.es_tecnico_activo()
    or public.soy_administrador()
    or (public.tiene_rol('SUPERVISOR') and public.tiene_permiso('ver_reportes'))
    or (
      public.soy_coordinador()
      and public.soy_coordinador_de_area(
        (select d.area_destino_id
           from public.incidencia_derivaciones d
          where d.incidencia_id = incidencias.id
            and d.activa
          limit 1)
      )
    )
  );

create policy p_incidencias_update_dueno on public.incidencias
  for update to authenticated
  using (usuario_reportante_id = public.usuario_actual())
  with check (
    usuario_reportante_id = public.usuario_actual()
    -- solo mueve su ticket a un estado final (confirmación de cierre)
    and (select e.nombre from public.estados_incidencia e
          where e.id = estado_id) in ('Cerrada', 'Cancelada')
    -- y nada más que el cierre (los demás campos quedan congelados)
    and descripcion  = (select x.descripcion  from public.incidencias x where x.id = incidencias.id)
    and prioridad_id = (select x.prioridad_id from public.incidencias x where x.id = incidencias.id)
    and ambiente_id  = (select x.ambiente_id  from public.incidencias x where x.id = incidencias.id)
    and tipo_incidencia_id = (select x.tipo_incidencia_id from public.incidencias x where x.id = incidencias.id)
  );

create policy p_incidencias_update_tecnico on public.incidencias
  for update to authenticated
  using (public.tengo_asignacion_activa(incidencias.id))
  with check (public.tengo_asignacion_activa(incidencias.id));

create policy p_incidencias_update_coordinador on public.incidencias
  for update to authenticated
  using (
    public.soy_coordinador()
    and public.soy_coordinador_de_area(
      (select d.area_destino_id
         from public.incidencia_derivaciones d
        where d.incidencia_id = incidencias.id
          and d.activa
        limit 1)
    )
  )
  with check (true);

-- ----------------------------------------------------------------------------
-- 5. Detalle de incidencias — "se ve lo mismo que la incidencia madre".
--    INSERT de adjuntos/comentarios/ubicaciones/equipos: dueño o técnico
--    asignado. Historial: técnico asignado (registro de acciones) o admin.
--    Asignaciones/Derivaciones: coordinador del área vigente o admin
--    (la derivación inicial la crea el sistema/trigger con definer).
-- ----------------------------------------------------------------------------
create policy p_ubicaciones_all on public.incidencia_ubicaciones
  for all to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  )
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_incidencia_equipos_all on public.incidencia_equipos
  for all to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  )
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_adjuntos_insert on public.incidencia_adjuntos
  for insert to authenticated
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
  );

create policy p_adjuntos_select on public.incidencia_adjuntos
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_comentarios_insert on public.incidencia_comentarios
  for insert to authenticated
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
  );

create policy p_comentarios_select on public.incidencia_comentarios
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_historial_insert on public.incidencia_historial
  for insert to authenticated
  with check (
    public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_historial_select on public.incidencia_historial
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_asignaciones_insert on public.incidencia_asignaciones
  for insert to authenticated
  with check (
    public.soy_administrador()
    or (
      public.soy_coordinador()
      and public.soy_coordinador_de_area(
        (select d.area_destino_id
           from public.incidencia_derivaciones d
          where d.incidencia_id = incidencia_asignaciones.incidencia_id
            and d.activa
          limit 1)
      )
    )
  );

create policy p_asignaciones_select on public.incidencia_asignaciones
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  );

create policy p_derivaciones_insert on public.incidencia_derivaciones
  for insert to authenticated
  with check (
    public.soy_administrador()
    or (
      public.soy_coordinador()
      and public.soy_coordinador_de_area(
        (select d2.area_destino_id
           from public.incidencia_derivaciones d2
          where d2.incidencia_id = incidencia_derivaciones.incidencia_id
            and d2.activa
          limit 1)
      )
    )
  );

create policy p_derivaciones_select on public.incidencia_derivaciones
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
    -- el coordinador necesita leer la derivación vigente de SU área: es la
    -- que determina qué tickets puede ver/asignar (evita recursión de policies)
    or public.soy_coordinador_de_area(area_destino_id)
  );

-- ----------------------------------------------------------------------------
-- 6. Organización — catálogos visibles para autenticados; gestión solo admin.
-- ----------------------------------------------------------------------------
create policy p_areas_select on public.areas
  for select to authenticated using (activo or public.soy_administrador());
create policy p_areas_admin on public.areas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_servicios_select on public.servicios
  for select to authenticated using (activo or public.soy_administrador());
create policy p_servicios_admin on public.servicios
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- tecnicos: el técnico ve su fila; el coordinador ve las de SU área; admin todo.
create policy p_tecnicos_select on public.tecnicos
  for select to authenticated
  using (
    perfil_id = public.usuario_actual()
    or public.soy_administrador()
    or (public.soy_coordinador() and public.soy_coordinador_de_area(area_id))
  );

create policy p_tecnicos_admin on public.tecnicos
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_especialidades_select on public.especialidades_tecnicas
  for select to authenticated using (activo or public.soy_administrador());
create policy p_especialidades_admin on public.especialidades_tecnicas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_tecnicos_esp_select on public.tecnicos_especialidades
  for select to authenticated using (true);
create policy p_tecnicos_esp_admin on public.tecnicos_especialidades
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_turnos_select on public.turnos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_turnos_admin on public.turnos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_tecnicos_turnos_select on public.tecnicos_turnos
  for select to authenticated using (true);
create policy p_tecnicos_turnos_admin on public.tecnicos_turnos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 7. Infraestructura — lectura para autenticados (reportar/seguir); gestión
--    solo admin.
-- ----------------------------------------------------------------------------
create policy p_infra_select_sedes on public.sedes
  for select to authenticated using (activa or public.soy_administrador());
create policy p_infra_admin_sedes on public.sedes
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_pabellones on public.pabellones
  for select to authenticated using (activo or public.soy_administrador());
create policy p_infra_admin_pabellones on public.pabellones
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_pisos on public.pisos
  for select to authenticated using (true);
create policy p_infra_admin_pisos on public.pisos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_tipos on public.tipos_ambiente
  for select to authenticated using (activo or public.soy_administrador());
create policy p_infra_admin_tipos on public.tipos_ambiente
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_ambientes on public.ambientes
  for select to authenticated using (activo or public.soy_administrador());
create policy p_infra_admin_ambientes on public.ambientes
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_aulas on public.aulas
  for select to authenticated using (true);
create policy p_infra_admin_aulas on public.aulas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_labs on public.laboratorios
  for select to authenticated using (true);
create policy p_infra_admin_labs on public.laboratorios
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_caract on public.ambientes_caracteristicas
  for select to authenticated using (true);
create policy p_infra_admin_caract on public.ambientes_caracteristicas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 8. Equipos — lectura para técnicos/coordinadores (diagnóstico); gestión admin.
-- ----------------------------------------------------------------------------
create policy p_equipos_lectura on public.equipos
  for select to authenticated
  using (public.es_tecnico_activo() or public.soy_coordinador() or public.soy_administrador());
create policy p_equipos_admin on public.equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_equipos_lectura on public.categorias_equipos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_equipos_admin on public.categorias_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_marcas_lectura on public.marcas_equipos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_marcas_admin on public.marcas_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_modelos_lectura on public.modelos_equipos
  for select to authenticated using (true);
create policy p_cat_modelos_admin on public.modelos_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_estados_eq_lectura on public.estados_equipos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_estados_eq_admin on public.estados_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_equipos_amb_lectura on public.equipos_ambientes
  for select to authenticated
  using (public.es_tecnico_activo() or public.soy_coordinador() or public.soy_administrador());
create policy p_equipos_amb_admin on public.equipos_ambientes
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_movimientos_lectura on public.movimientos_equipos
  for select to authenticated
  using (public.es_tecnico_activo() or public.soy_coordinador() or public.soy_administrador());
create policy p_movimientos_admin on public.movimientos_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 9. QR — lectura autenticada; gestión admin. lecturas_qr: cualquiera
--    autenticado registra su escaneo; solo admin las consulta.
-- ----------------------------------------------------------------------------
create policy p_qr_lectura on public.codigos_qr
  for select to authenticated using (activo or public.soy_administrador());
create policy p_qr_admin on public.codigos_qr
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_lecturas_qr_insert on public.lecturas_qr
  for insert to authenticated with check (true);
create policy p_lecturas_qr_select on public.lecturas_qr
  for select to authenticated using (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 10. Catálogos de incidencias — lectura autenticados; gestión admin.
-- ----------------------------------------------------------------------------
create policy p_cat_lectura_tipos_incidencia on public.tipos_incidencia
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_tipos_incidencia on public.tipos_incidencia
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_subtipos on public.subtipos_incidencia
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_subtipos on public.subtipos_incidencia
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_prioridades on public.prioridades
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_prioridades on public.prioridades
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_estados on public.estados_incidencia
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_estados on public.estados_incidencia
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_canales on public.canales_reporte
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_canales on public.canales_reporte
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 11. SLA / reglas / feriados — lectura; gestión admin (reglas también
--     coordinador con permiso gestionar_reglas).
-- ----------------------------------------------------------------------------
create policy p_sla_lectura on public.acuerdos_nivel_servicio
  for select to authenticated using (activo or public.soy_administrador());
create policy p_sla_admin on public.acuerdos_nivel_servicio
  for all to authenticated
  using (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')))
  with check (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')));

create policy p_tiempos_sla_select on public.tiempos_sla
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  );

create policy p_feriados_lectura on public.feriados
  for select to authenticated using (true);
create policy p_feriados_admin on public.feriados
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_reglas_lectura on public.reglas_enrutamiento
  for select to authenticated using (activa or public.soy_administrador());
create policy p_reglas_admin on public.reglas_enrutamiento
  for all to authenticated
  using (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')))
  with check (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')));

-- ----------------------------------------------------------------------------
-- 12. Notificaciones — SOLO las del propio usuario (las crea el sistema).
-- ----------------------------------------------------------------------------
create policy p_notificaciones_select on public.notificaciones
  for select to authenticated using (perfil_id = public.usuario_actual());
create policy p_notificaciones_update on public.notificaciones
  for update to authenticated
  using (perfil_id = public.usuario_actual())
  with check (perfil_id = public.usuario_actual());

create policy p_plantillas_select on public.plantillas_notificacion
  for select to authenticated using (activo or public.soy_administrador());
create policy p_plantillas_admin on public.plantillas_notificacion
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_preferencias_all on public.preferencias_notificacion
  for all to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador())
  with check (perfil_id = public.usuario_actual() or public.soy_administrador());

create policy p_dispositivos_all on public.dispositivos_usuario
  for all to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador())
  with check (perfil_id = public.usuario_actual() or public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 13. Encuestas — el dueño del ticket ve su encuesta y responde UNA vez;
--     el flujo con token anónimo se resolverá con RPC segura (fase auth).
-- ----------------------------------------------------------------------------
create policy p_encuestas_select on public.encuestas_cierre
  for select to authenticated
  using (public.es_dueno_incidencia(incidencia_id) or public.soy_administrador());

create policy p_respuestas_insert on public.respuestas_encuesta
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.encuestas_cierre e
        join public.incidencias i on i.id = e.incidencia_id
       where e.id = respuestas_encuesta.encuesta_id
         and i.usuario_reportante_id = public.usuario_actual()
    )
    -- una sola respuesta por encuesta (1:1 del modelo)
    and not exists (
      select 1 from public.respuestas_encuesta r
       where r.encuesta_id = respuestas_encuesta.encuesta_id
    )
  );

create policy p_respuestas_select on public.respuestas_encuesta
  for select to authenticated
  using (
    public.es_dueno_incidencia(
      (select e.incidencia_id from public.encuestas_cierre e
        where e.id = respuestas_encuesta.encuesta_id)
    )
    or public.soy_administrador()
  );

-- ----------------------------------------------------------------------------
-- 14. Base de conocimiento — artículos publicados para todos los autenticados.
-- ----------------------------------------------------------------------------
create policy p_cat_conocimiento_lectura on public.categorias_conocimiento
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_conocimiento_admin on public.categorias_conocimiento
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_articulos_lectura on public.articulos_conocimiento
  for select to authenticated using (publicado or public.soy_administrador());
create policy p_articulos_admin on public.articulos_conocimiento
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 15. Auditoría — PROTECCIÓN TOTAL:
--     · SELECT: solo admin con permiso ver_auditoria.
--     · INSERT/UPDATE/DELETE: sin policy → denegado desde la API. La única
--       escritura es por triggers/RPC SECURITY DEFINER del sistema (0004).
--     · Además 0004 ya bloquea UPDATE/DELETE a nivel de trigger (append-only).
-- ----------------------------------------------------------------------------
create policy p_auditoria_select on public.registros_auditoria
  for select to authenticated
  using (public.soy_administrador() and public.tiene_permiso('ver_auditoria'));

-- ----------------------------------------------------------------------------
-- 16. Sesiones — el usuario ve SU historial de accesos; admin todo. Sin
--     INSERT desde cliente (lo escribe el proceso de auth vía RPC segura).
-- ----------------------------------------------------------------------------
create policy p_sesiones_select on public.sesiones_usuario
  for select to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 17. Reportes — el usuario ve SUS reportes/exportaciones; crea con permiso.
-- ----------------------------------------------------------------------------
create policy p_reportes_select on public.reportes_generados
  for select to authenticated
  using (solicitado_por = public.usuario_actual() or public.soy_administrador());
create policy p_reportes_insert on public.reportes_generados
  for insert to authenticated
  with check (public.tiene_permiso('ver_reportes') and solicitado_por = public.usuario_actual());

create policy p_exportaciones_select on public.exportaciones
  for select to authenticated
  using (
    public.soy_administrador()
    or exists (
      select 1 from public.reportes_generados r
       where r.id = exportaciones.reporte_id
         and r.solicitado_por = public.usuario_actual()
    )
  );
create policy p_exportaciones_insert on public.exportaciones
  for insert to authenticated
  with check (public.tiene_permiso('ver_reportes'));

-- ----------------------------------------------------------------------------
-- 18. GRANT explícitos (techo de privilegios; la policy decide por fila).
-- ----------------------------------------------------------------------------
grant select on all tables in schema public to authenticated;

grant insert, update on public.incidencias to authenticated;
grant update on public.perfiles to authenticated;
grant insert, update on public.incidencia_adjuntos,
  public.incidencia_comentarios, public.incidencia_historial,
  public.incidencia_ubicaciones, public.incidencia_equipos,
  public.incidencia_asignaciones, public.incidencia_derivaciones to authenticated;
grant insert on public.lecturas_qr, public.respuestas_encuesta,
  public.reportes_generados, public.exportaciones to authenticated;
grant insert, update on public.notificaciones, public.preferencias_notificacion,
  public.dispositivos_usuario to authenticated;
-- Gestión de catálogos/configuración: el techo permite, la policy limita a admin
-- (y coordinador con gestionar_reglas en SLA/reglas).
grant insert, update, delete on public.roles, public.permisos,
  public.roles_permisos, public.usuarios_roles, public.areas, public.servicios,
  public.tecnicos, public.especialidades_tecnicas,
  public.tecnicos_especialidades, public.turnos, public.tecnicos_turnos,
  public.sedes, public.pabellones, public.pisos, public.tipos_ambiente,
  public.ambientes, public.aulas, public.laboratorios,
  public.ambientes_caracteristicas, public.categorias_equipos,
  public.marcas_equipos, public.modelos_equipos, public.estados_equipos,
  public.equipos, public.equipos_ambientes, public.movimientos_equipos,
  public.codigos_qr, public.tipos_incidencia, public.subtipos_incidencia,
  public.prioridades, public.estados_incidencia, public.canales_reporte,
  public.acuerdos_nivel_servicio, public.feriados, public.reglas_enrutamiento,
  public.plantillas_notificacion,
  public.categorias_conocimiento, public.articulos_conocimiento
  to authenticated;

-- ----------------------------------------------------------------------------
-- 19. Verificación estructural: todas las tablas con RLS activado.
-- ----------------------------------------------------------------------------
do $$
declare
  sin_rls int;
begin
  select count(*) into sin_rls
  from pg_tables
  where schemaname in ('public', 'private')
    and rowsecurity = false;
  if sin_rls > 0 then
    raise exception '% tablas sin RLS tras la migracion', sin_rls;
  end if;
end
$$;
