-- ============================================================================
-- SIR-UPSJB · 0005_seed_catalogos.sql
-- Semillas mínimas de catálogos. Idempotente: ON CONFLICT DO NOTHING
-- (re-ejecutable sin duplicar filas).
--
--   NOTA: son valores PROPUESTOS por el equipo técnico [P]; los marcados [VI]
--   quedan pendientes de validación institucional (docs/01 §11). El
--   administrador podrá ampliar/editar catálogos desde la app (Regla 10).
--
--   Requeridos por el sistema:
--   · prioridad 'Media', estado 'Pendiente', canal 'QR'  → defaults (0003/0004)
--   · rol 'ESTUDIANTE'                                    → register_new_user
--   · 8 eventos de plantilla                              → CK de notificaciones
--   · estados de incidencia 'Cerrada'/'Cancelada' es_final=true (flujo §6.5)
-- ============================================================================

-- M1 · Roles [P] (semilla [VI] — §6.1)
insert into public.roles (nombre, descripcion) values
  ('ADMINISTRADOR', 'Control total del sistema, configuración y usuarios'),
  ('COORDINADOR',   'Supervisión por sede/área, reportes y asignación'),
  ('TECNICO',       'Atención y resolución de incidencias asignadas'),
  ('DOCENTE',       'Docente de la Filial Ica; reporta y da seguimiento'),
  ('ESTUDIANTE',    'Estudiante; reporta y da seguimiento (rol base)'),
  ('ADMINISTRATIVO','Personal administrativo; reporta y da seguimiento'),
  ('SUPERVISOR',    'Rol pendiente de definición de permisos [VI]')
on conflict (nombre) do nothing;

-- M1 · Permisos atómicos [P]
insert into public.permisos (codigo, descripcion) values
  ('crear_incidencia',        'Reportar incidencias (mínimo transversal)'),
  ('ver_incidencias_propias', 'Ver y seguir las incidencias propias'),
  ('comentar_incidencia',     'Participar en la conversación de un ticket'),
  ('adjuntar_evidencia',      'Subir adjuntos a un ticket'),
  ('asignar_incidencia',      'Asignar técnicos a incidencias'),
  ('derivar_incidencia',      'Derivar incidencias entre áreas'),
  ('cambiar_estado',          'Mover el estado de una incidencia'),
  ('cerrar_incidencia',       'Cerrar o cancelar incidencias'),
  ('resolver_incidencia',     'Registrar resolución de incidencias'),
  ('gestionar_usuarios',      'Alta, edición y roles de usuarios'),
  ('gestionar_organizacion',  'Áreas, servicios, técnicos y turnos'),
  ('gestionar_infraestructura','Sedes, pabellones, pisos y ambientes'),
  ('gestionar_equipos',       'Inventario de equipos y movimientos'),
  ('gestionar_qr',            'Generar y deshabilitar códigos QR'),
  ('gestionar_reglas',        'Reglas de derivación y SLA'),
  ('ver_reportes',            'Consultar y exportar reportes'),
  ('ver_auditoria',           'Consultar registros de auditoría'),
  ('gestionar_conocimiento',  'Administrar la base de conocimiento'),
  ('gestionar_notificaciones','Plantillas y canales de notificación')
on conflict (codigo) do nothing;

-- M1 · Permisos base por rol [P] (matriz mínima; se ajusta en la fase de RLS)
insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on (
  (r.nombre = 'ADMINISTRADOR') or
  (r.nombre = 'COORDINADOR'   and p.codigo in
    ('ver_incidencias_propias','asignar_incidencia','derivar_incidencia',
     'cambiar_estado','ver_reportes')) or
  (r.nombre = 'TECNICO'       and p.codigo in
    ('ver_incidencias_propias','cambiar_estado','resolver_incidencia',
     'adjuntar_evidencia','comentar_incidencia')) or
  (r.nombre in ('DOCENTE','ESTUDIANTE','ADMINISTRATIVO','SUPERVISOR') and
     p.codigo in
    ('crear_incidencia','ver_incidencias_propias','comentar_incidencia',
     'adjuntar_evidencia'))
)
on conflict do nothing;

-- M2 · Tipos de ambiente [P]
insert into public.tipos_ambiente (nombre) values
  ('Aula'), ('Laboratorio'), ('Oficina'), ('Auditorio'), ('Biblioteca'),
  ('Baño'), ('Taller'), ('Almacen'), ('Otro')
on conflict (nombre) do nothing;

-- M3 · Catálogos de equipos [P]
insert into public.categorias_equipos (nombre) values
  ('Computadora'), ('Laptop'), ('Monitor'), ('Impresora'), ('Proyector'),
  ('Switch'), ('Access Point'), ('Impresora de red'), ('Scanner'), ('Otro')
on conflict (nombre) do nothing;

insert into public.marcas_equipos (nombre) values
  ('HP'), ('Dell'), ('Lenovo'), ('Asus'), ('Acer'), ('Epson'),
  ('Canon'), ('Cisco'), ('TP-Link'), ('Genérico')
on conflict (nombre) do nothing;

insert into public.estados_equipos (nombre, es_final) values
  ('Operativo',        false),
  ('En mantenimiento', false),
  ('Dañado',           false),
  ('En reparación',    false),
  ('Fuera de servicio', true),
  ('Baja',             true)
on conflict (nombre) do nothing;

-- M5 · Catálogos de incidencias
-- Prioridades: nivel 1=Baja … 4=Crítica (orden para SLA) [P]
insert into public.prioridades (nombre, nivel, color) values
  ('Baja',     1, '#22c55e'),
  ('Media',    2, '#eab308'),
  ('Alta',     3, '#f97316'),
  ('Crítica',  4, '#ef4444')
on conflict (nombre) do nothing;

-- Estados del flujo (orden = secuencia) [P]
insert into public.estados_incidencia (nombre, orden, es_final, color) values
  ('Pendiente',  1, false, '#eab308'),
  ('Asignada',   2, false, '#3b82f6'),
  ('En proceso', 3, false, '#6366f1'),
  ('En espera',  4, false, '#a855f7'),
  ('Resuelta',   5, false, '#22c55e'),
  ('Cerrada',    6, true,  '#6b7280'),
  ('Cancelada',  7, true,  '#9ca3af')
on conflict (nombre) do nothing;

insert into public.canales_reporte (nombre) values
  ('QR'), ('Web'), ('Administrador'), ('Docente'), ('Teléfono'), ('Otro')
on conflict (nombre) do nothing;

-- Tipos de incidencia [P]; lista oficial [VI] (§11.1)
insert into public.tipos_incidencia (nombre) values
  ('Técnica'), ('Infraestructura'), ('Conectividad'), ('Mobiliario'),
  ('Limpieza'), ('Seguridad'), ('Académica'), ('Administrativa'), ('Otro')
on conflict (nombre) do nothing;

-- Subtipos de ejemplo para los tipos más operativos [P]
insert into public.subtipos_incidencia (tipo_incidencia_id, nombre)
select t.id, v.nombre
from (values
  ('Técnica',       'Computadora no enciende'),
  ('Técnica',       'Monitor sin señal'),
  ('Técnica',       'Impresora atascada'),
  ('Técnica',       'Software con error'),
  ('Conectividad',  'Internet lento'),
  ('Conectividad',  'Sin acceso a la red'),
  ('Conectividad',  'WiFi intermitente'),
  ('Infraestructura','Luminaria fundida'),
  ('Infraestructura','Fuga de agua'),
  ('Mobiliario',    'Silla dañada'),
  ('Mobiliario',    'Escritorio dañado')
) as v(tipo, nombre)
join public.tipos_incidencia t on t.nombre = v.tipo
on conflict do nothing;

-- M7 · Especialidades [P]
insert into public.especialidades_tecnicas (nombre) values
  ('Soporte'), ('Redes'), ('Hardware'), ('Software'),
  ('Electricidad'), ('Climatización'), ('Infraestructura')
on conflict (nombre) do nothing;

-- M10 · Plantillas por evento (cuerpo con placeholders [P])
insert into public.plantillas_notificacion (evento, asunto, cuerpo, canal) values
  ('nueva_incidencia', 'Reporte registrado: {{codigo}}',
   'Tu reporte en {{ambiente}} fue registrado con el código {{codigo}}. Puedes seguirlo con ese código.', 'interna'),
  ('asignada', 'Incidencia {{codigo}} asignada',
   'La incidencia {{codigo}} fue asignada a un técnico de {{area}}.', 'interna'),
  ('en_proceso', 'Incidencia {{codigo}} en proceso',
   'La incidencia {{codigo}} está siendo atendida.', 'interna'),
  ('en_espera', 'Incidencia {{codigo}} en espera',
   'La incidencia {{codigo}} quedó en espera: {{detalle}}.', 'interna'),
  ('resuelta', 'Incidencia {{codigo}} resuelta',
   'La incidencia {{codigo}} fue resuelta. Confirma y responde la encuesta de cierre.', 'interna'),
  ('cerrada', 'Incidencia {{codigo}} cerrada',
   'La incidencia {{codigo}} fue cerrada. Gracias por tu reporte.', 'interna'),
  ('cancelada', 'Incidencia {{codigo}} cancelada',
   'La incidencia {{codigo}} fue cancelada: {{detalle}}.', 'interna'),
  ('comentario', 'Nuevo comentario en {{codigo}}',
   'Hay un nuevo comentario en la incidencia {{codigo}}.', 'interna')
on conflict (evento) do nothing;

-- M9 · SLA base por prioridad — VALORES PROPUESTOS [VI] (Plan §19.2)
-- Guard NOT EXISTS: la tabla no tiene restricción UNIQUE aplicable y el índice
-- parcial uq_sla_prioridad rechazaría el re-insert (idempotencia explícita).
insert into public.acuerdos_nivel_servicio
  (prioridad_id, horas_respuesta, horas_resolucion)
select p.id, v.h_resp, v.h_resol
from (values
  ('Baja',    48.0, 96.0),
  ('Media',   24.0, 48.0),
  ('Alta',     4.0,  8.0),
  ('Crítica',  1.0,  4.0)
) as v(nombre, h_resp, h_resol)
join public.prioridades p on p.nombre = v.nombre
where not exists (
  select 1 from public.acuerdos_nivel_servicio a
  where a.prioridad_id = p.id
    and a.tipo_incidencia_id is null
);
