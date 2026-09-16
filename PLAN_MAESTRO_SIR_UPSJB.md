# PLAN MAESTRO DEL PROYECTO
# SIR-UPSJB — Sistema Integral de Registro, Atención y Seguimiento de Incidencias

**Institución:** Universidad Privada San Juan Bautista – Filial Ica  
**Proyecto:** Sistema Integral de Gestión de Incidencias  
**Versión:** 1.0  
**Base de datos:** Supabase / PostgreSQL  
**Frontend:** Next.js + TypeScript  
**Estilo visual:** Basado en el sitio de referencia proporcionado por el usuario  
**Identidad institucional:** Uso del logo oficial de la UPSJB  
**Estado:** Planificación y diseño
**Tecnologias que se usaran: Next.js + React + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + Supabase/PostgreSQL + Supabase Auth + Storage + Realtime + RLS + GitHub + Vercel.**
---

## 1. Descripción general

SIR-UPSJB será una plataforma web para registrar, clasificar, asignar, atender, derivar, hacer seguimiento y cerrar incidencias dentro de la Universidad Privada San Juan Bautista, inicialmente para la Filial Ica.

El sistema utilizará códigos QR ubicados en aulas, laboratorios, oficinas y otros ambientes. Cuando un usuario detecte un problema, podrá escanear el QR del ambiente y acceder directamente al formulario de reporte.

El sistema identificará automáticamente el lugar asociado al código QR y permitirá registrar la incidencia sin que el usuario tenga que escribir manualmente la sede, pabellón o ambiente.

El objetivo es convertir un reporte aislado en un proceso trazable:

```text
Detección
   ↓
Escaneo QR
   ↓
Registro
   ↓
Clasificación
   ↓
Priorización
   ↓
Asignación
   ↓
Atención
   ↓
Seguimiento
   ↓
Resolución
   ↓
Confirmación
   ↓
Cierre
   ↓
Historial y estadísticas
```

---

# 2. Objetivo general

Diseñar y desarrollar un sistema web integral que permita gestionar de manera organizada y trazable las incidencias de infraestructura, tecnología, conectividad, mobiliario, servicios y otras categorías de atención de la UPSJB Filial Ica.

---

# 3. Objetivos específicos

- Registrar incidencias mediante códigos QR asociados a ambientes.
- Identificar automáticamente el lugar donde ocurre la incidencia.
- Clasificar las incidencias por categoría y subcategoría.
- Asignar incidencias al área o personal responsable.
- Permitir el seguimiento del estado de cada incidencia.
- Registrar evidencias, fotografías, comentarios y diagnósticos.
- Mantener un historial completo de cambios.
- Controlar usuarios mediante roles y permisos.
- Administrar aulas, laboratorios, ambientes y equipos.
- Medir tiempos de atención y resolución.
- Implementar reglas de derivación entre áreas.
- Generar estadísticas y reportes.
- Implementar auditoría de acciones importantes.
- Preparar la arquitectura para futuras integraciones.
- Permitir la expansión posterior a otras sedes.

---

# 4. Alcance inicial

## 4.1 Sede inicial

La primera implementación será:

**UPSJB – Filial Ica**

El diseño de la base de datos será multi-sede desde el comienzo para evitar reconstruir el sistema cuando se incorporen otras sedes.

Estructura conceptual:

```text
SIR-UPSJB
├── Ica
├── Chincha
├── Chorrillos
└── San Borja
```

Las sedes adicionales podrán habilitarse posteriormente.

---

# 5. Usuarios del sistema

## 5.1 Estudiante

Puede:

- Escanear códigos QR.
- Registrar incidencias.
- Adjuntar fotografías.
- Consultar su incidencia.
- Consultar el estado.
- Recibir notificaciones.
- Confirmar si la solución fue satisfactoria.

## 5.2 Docente

Puede:

- Registrar incidencias.
- Reportar problemas de aulas y laboratorios.
- Consultar incidencias propias.
- Realizar seguimiento.
- Confirmar resolución.

## 5.3 Personal administrativo

Puede:

- Registrar incidencias.
- Consultar reportes.
- Hacer seguimiento.
- Confirmar resolución cuando corresponda.

## 5.4 Técnico

Puede:

- Ver incidencias asignadas.
- Aceptar una incidencia.
- Cambiar su estado.
- Registrar diagnóstico.
- Registrar acciones realizadas.
- Adjuntar evidencias.
- Registrar materiales utilizados.
- Marcar la incidencia como resuelta.

## 5.5 Coordinador

Puede:

- Supervisar incidencias.
- Asignar técnicos.
- Derivar incidencias.
- Cambiar prioridades.
- Revisar SLA.
- Consultar estadísticas.
- Supervisar desempeño operativo.

## 5.6 Administrador

Puede:

- Gestionar usuarios.
- Gestionar roles.
- Gestionar permisos.
- Gestionar sedes.
- Gestionar pabellones.
- Gestionar ambientes.
- Gestionar aulas.
- Gestionar laboratorios.
- Gestionar equipos.
- Generar códigos QR.
- Gestionar áreas.
- Gestionar técnicos.
- Gestionar reglas.
- Gestionar SLA.
- Consultar auditoría.
- Generar reportes.

---

# 6. Flujo principal del sistema

```text
┌─────────────────────┐
│ Usuario detecta     │
│ una incidencia      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Escanea código QR   │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Sistema identifica  │
│ ambiente            │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Usuario completa    │
│ formulario          │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Sistema crea        │
│ incidencia          │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Clasificación       │
│ automática/manual   │
└──────────┬──────────┘
           ↓
       ¿Técnica?
       /       \
     Sí         No
     ↓           ↓
    TI       Área correspondiente
     \           /
      \         /
       ↓       ↓
      Asignación
           ↓
      Atención
           ↓
      Diagnóstico
           ↓
      En proceso
           ↓
       Resuelta
           ↓
   Confirmación usuario
           ↓
         Cerrada
           ↓
       Estadísticas
```

---

# 7. Principio fundamental del sistema

El sistema no será únicamente un formulario.

Será un **sistema de tickets/incidencias con trazabilidad completa**.

Cada incidencia tendrá:

```text
Código único
Usuario reportante
Sede
Pabellón
Piso
Ambiente
Equipo relacionado
Categoría
Subcategoría
Prioridad
Estado
Área responsable
Técnico asignado
Descripción
Evidencias
Comentarios
Diagnóstico
Acciones realizadas
Fechas
Historial
SLA
Confirmación
Encuesta
Auditoría
```

---

# 8. Tecnología

## 8.1 Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Lucide Icons
- Recharts o librería equivalente para estadísticas

## 8.2 Backend

Supabase.

Se utilizarán:

- PostgreSQL.
- Supabase Auth.
- Supabase Storage.
- Supabase Realtime.
- Row Level Security.
- Edge Functions cuando sean necesarias.

## 8.3 Despliegue

Frontend:

```text
Vercel
```

Backend:

```text
Supabase
```

Repositorio:

```text
GitHub
```

---

# 9. Arquitectura general

```text
                         USUARIO
                            │
                    ┌───────┴───────┐
                    │               │
                   WEB              QR
                    │               │
                    └───────┬───────┘
                            ↓
                     ┌─────────────┐
                     │   Next.js   │
                     │ TypeScript  │
                     └──────┬──────┘
                            ↓
                     ┌─────────────┐
                     │  Servicios  │
                     │  y lógica   │
                     └──────┬──────┘
                            ↓
                     ┌─────────────┐
                     │  Supabase   │
                     ├─────────────┤
                     │ PostgreSQL  │
                     │ Auth        │
                     │ Storage     │
                     │ Realtime    │
                     └──────┬──────┘
                            ↓
                ┌───────────┴───────────┐
                │                       │
          Panel técnico            Panel admin
```

---

# 10. Diseño de base de datos

La base de datos será relacional y normalizada.

Se plantea inicialmente una arquitectura de aproximadamente **58 tablas lógicas**, agrupadas por módulos.

La cantidad podrá ajustarse durante el modelamiento físico si alguna relación puede resolverse de manera más correcta mediante una tabla existente.

---

# 11. Módulo de usuarios y seguridad

## 11.1 `perfiles`

Información adicional del usuario autenticado.

Campos principales:

```text
id
usuario_auth_id
nombres
apellido_paterno
apellido_materno
documento
correo
telefono
codigo_usuario
estado
fecha_creacion
fecha_actualizacion
```

## 11.2 `roles`

Ejemplos:

```text
ADMINISTRADOR
COORDINADOR
TECNICO
DOCENTE
ESTUDIANTE
ADMINISTRATIVO
SUPERVISOR
```

## 11.3 `permisos`

Ejemplos:

```text
crear_incidencia
editar_incidencia
asignar_incidencia
derivar_incidencia
resolver_incidencia
cerrar_incidencia
gestionar_usuarios
gestionar_ambientes
gestionar_equipos
gestionar_qr
ver_reportes
ver_auditoria
```

## 11.4 `roles_permisos`

Relación N:M entre roles y permisos.

## 11.5 `usuarios_roles`

Permite asignar uno o varios roles a un usuario.

---

# 12. Módulo de infraestructura

## 12.1 `sedes`

Representa las sedes o filiales.

## 12.2 `pabellones`

Representa edificios o pabellones.

## 12.3 `pisos`

Representa niveles dentro de los pabellones.

## 12.4 `tipos_ambiente`

Ejemplos:

```text
Aula
Laboratorio
Oficina
Auditorio
Biblioteca
Baño
Taller
Almacén
Otro
```

## 12.5 `ambientes`

Información general de cada espacio.

## 12.6 `aulas`

Información especializada de aulas.

## 12.7 `laboratorios`

Información especializada de laboratorios.

## 12.8 `ambientes_caracteristicas`

Características:

```text
capacidad
proyector
computadoras
internet
aire_acondicionado
pizarra
etc.
```

---

# 13. Módulo de equipos

## 13.1 `categorias_equipos`

Ejemplos:

```text
Computadora
Monitor
Proyector
Impresora
Router
Switch
Access Point
UPS
Teléfono
Otro
```

## 13.2 `marcas_equipos`

Catálogo de fabricantes.

## 13.3 `modelos_equipos`

Modelos asociados a marcas.

## 13.4 `estados_equipos`

```text
Operativo
En mantenimiento
Dañado
Fuera de servicio
Baja
```

## 13.5 `equipos`

Información de activos.

Ejemplo:

```text
codigo_interno
numero_serie
categoria
marca
modelo
estado
fecha_adquisicion
garantia
```

## 13.6 `equipos_ambientes`

Relaciona equipos con ambientes.

## 13.7 `movimientos_equipos`

Registra movimientos históricos.

Ejemplo:

```text
B-104
  ↓
B-203
  ↓
Almacén
```

---

# 14. Módulo QR

## 14.1 `codigos_qr`

Cada ambiente tendrá un código QR único.

Ejemplo:

```text
ICA-B-B104-0001
```

## 14.2 `lecturas_qr`

Registra:

```text
qr
usuario
fecha
dispositivo
navegador
ip_hash
```

La IP no debe almacenarse innecesariamente si no existe una finalidad legítima definida.

---

# 15. Módulo de incidencias

## 15.1 `tipos_incidencia`

Ejemplos:

```text
Técnica
Infraestructura
Conectividad
Mobiliario
Limpieza
Seguridad
Académica
Administrativa
Otro
```

## 15.2 `subtipos_incidencia`

Ejemplos:

```text
Computadora no enciende
Monitor sin señal
Internet lento
Proyector no funciona
Teclado dañado
Mouse dañado
Puerta dañada
Luz
Aire acondicionado
Carpeta dañada
etc.
```

## 15.3 `prioridades`

```text
Baja
Media
Alta
Crítica
```

## 15.4 `estados_incidencia`

```text
Pendiente
Asignada
En proceso
En espera
Derivada
Resuelta
Cerrada
Cancelada
```

## 15.5 `canales_reporte`

```text
QR
Web
Administrador
Docente
Teléfono
Otro
```

## 15.6 `incidencias`

Tabla principal.

Campos conceptuales:

```text
id
codigo
usuario_reportante_id
tipo_incidencia_id
subtipo_incidencia_id
prioridad_id
estado_id
canal_reporte_id
ambiente_id
descripcion
fecha_reporte
fecha_asignacion
fecha_inicio
fecha_resolucion
fecha_cierre
```

---

# 16. Módulo de detalle de incidencias

## 16.1 `incidencia_ubicaciones`

Permite mantener información específica de ubicación cuando sea necesaria.

## 16.2 `incidencia_equipos`

Relaciona una incidencia con uno o varios equipos.

## 16.3 `incidencia_adjuntos`

Fotografías, videos y documentos.

## 16.4 `incidencia_comentarios`

Conversación entre participantes.

## 16.5 `incidencia_historial`

Registra cada cambio de estado o modificación relevante.

Ejemplo:

```text
Pendiente
↓
Asignada
↓
En proceso
↓
Resuelta
↓
Cerrada
```

## 16.6 `incidencia_asignaciones`

Registra técnicos responsables.

## 16.7 `incidencia_derivaciones`

Permite transferir la incidencia entre áreas.

Ejemplo:

```text
Sistemas
   ↓
Infraestructura
```

---

# 17. Módulo organizacional

## 17.1 `areas`

Ejemplos iniciales para modelamiento:

```text
Sistemas de Información
Infraestructura y Servicios Generales
Logística
Administración
Recursos Humanos
SAE
Otros
```

La estructura definitiva deberá validarse con la universidad antes de convertirse en configuración oficial.

## 17.2 `servicios`

Ejemplos:

```text
Soporte de computadoras
Redes
Sistemas
Infraestructura
Mantenimiento
Electricidad
Mobiliario
```

## 17.3 `tecnicos`

Información del personal encargado de atención.

## 17.4 `especialidades_tecnicas`

Ejemplos:

```text
Soporte
Redes
Hardware
Software
Electricidad
Infraestructura
Mantenimiento
```

## 17.5 `tecnicos_especialidades`

Relación N:M.

## 17.6 `turnos`

Define horarios de atención.

## 17.7 `tecnicos_turnos`

Relaciona técnicos con turnos.

---

# 18. Módulo de reglas de derivación

## 18.1 `reglas_enrutamiento`

Permitirá determinar automáticamente el área responsable.

Ejemplo:

```text
TIPO = Técnica
SUBTIPO = Redes
        ↓
Área = Sistemas
Servicio = Redes
```

Otro:

```text
TIPO = Infraestructura
        ↓
Área = Infraestructura
```

Las reglas serán configurables desde administración.

---

# 19. Módulo SLA

## 19.1 `acuerdos_nivel_servicio`

Define parámetros de atención según prioridad o categoría.

## 19.2 `tiempos_sla`

Registra tiempos de respuesta y atención.

Ejemplo de configuración inicial:

| Prioridad | Tiempo objetivo |
|---|---:|
| Baja | 48 horas |
| Media | 24 horas |
| Alta | 4 horas |
| Crítica | 1 hora |

Estos valores serán configurables y no deben presentarse como política oficial de la UPSJB hasta que sean validados institucionalmente.

## 19.3 `feriados`

Permite considerar días no laborables en los cálculos correspondientes.

---

# 20. Módulo de notificaciones

## 20.1 `notificaciones`

Notificaciones internas.

Ejemplos:

```text
Nueva incidencia registrada.
Incidencia asignada.
Incidencia en proceso.
Incidencia resuelta.
Incidencia cerrada.
```

## 20.2 `plantillas_notificacion`

Plantillas reutilizables.

## 20.3 `preferencias_notificacion`

Permite configurar qué notificaciones recibe cada usuario.

## 20.4 `dispositivos_usuario`

Preparación para futuras notificaciones push.

---

# 21. Módulo de satisfacción

## 21.1 `encuestas_cierre`

Encuesta posterior a la resolución.

## 21.2 `respuestas_encuesta`

Ejemplo:

```text
calificacion
comentario
fecha
```

La encuesta permitirá medir la percepción del usuario sobre la atención sin convertir la calificación en una medida única de desempeño.

---

# 22. Módulo de conocimiento

## 22.1 `categorias_conocimiento`

Clasifica artículos.

## 22.2 `articulos_conocimiento`

Ejemplos:

```text
¿Qué hacer si el proyector no muestra imagen?
¿Qué hacer si no tengo conexión?
¿Cómo conectar un equipo al Wi-Fi?
```

El sistema podrá mostrar artículos relacionados antes o después de registrar una incidencia.

---

# 23. Módulo de auditoría

## 23.1 `sesiones_usuario`

Registra información necesaria de las sesiones.

## 23.2 `registros_auditoria`

Ejemplo:

```text
Usuario: Administrador
Acción: CAMBIO_ESTADO
Incidencia: INC-2026-00124
Antes: Pendiente
Después: En proceso
Fecha: 15/09/2026 21:42
```

La auditoría debe ser protegida para evitar que usuarios normales modifiquen sus propios registros.

---

# 24. Módulo de reportes

## 24.1 `reportes_generados`

Registro de reportes solicitados.

## 24.2 `exportaciones`

Control de exportaciones:

```text
PDF
Excel
CSV
```

---

# 25. Resumen de tablas

| # | Tabla |
|---:|---|
| 01 | perfiles |
| 02 | roles |
| 03 | permisos |
| 04 | roles_permisos |
| 05 | usuarios_roles |
| 06 | sedes |
| 07 | pabellones |
| 08 | pisos |
| 09 | tipos_ambiente |
| 10 | ambientes |
| 11 | aulas |
| 12 | laboratorios |
| 13 | ambientes_caracteristicas |
| 14 | categorias_equipos |
| 15 | marcas_equipos |
| 16 | modelos_equipos |
| 17 | estados_equipos |
| 18 | equipos |
| 19 | equipos_ambientes |
| 20 | movimientos_equipos |
| 21 | codigos_qr |
| 22 | lecturas_qr |
| 23 | tipos_incidencia |
| 24 | subtipos_incidencia |
| 25 | prioridades |
| 26 | estados_incidencia |
| 27 | canales_reporte |
| 28 | incidencias |
| 29 | incidencia_ubicaciones |
| 30 | incidencia_equipos |
| 31 | incidencia_adjuntos |
| 32 | incidencia_comentarios |
| 33 | incidencia_historial |
| 34 | incidencia_asignaciones |
| 35 | incidencia_derivaciones |
| 36 | areas |
| 37 | servicios |
| 38 | tecnicos |
| 39 | especialidades_tecnicas |
| 40 | tecnicos_especialidades |
| 41 | turnos |
| 42 | tecnicos_turnos |
| 43 | reglas_enrutamiento |
| 44 | acuerdos_nivel_servicio |
| 45 | tiempos_sla |
| 46 | feriados |
| 47 | notificaciones |
| 48 | plantillas_notificacion |
| 49 | preferencias_notificacion |
| 50 | dispositivos_usuario |
| 51 | encuestas_cierre |
| 52 | respuestas_encuesta |
| 53 | categorias_conocimiento |
| 54 | articulos_conocimiento |
| 55 | sesiones_usuario |
| 56 | registros_auditoria |
| 57 | reportes_generados |
| 58 | exportaciones |

---

# 26. Página principal

La página inicial tendrá una apariencia moderna y tecnológica.

Debe utilizar:

- Logo UPSJB.
- Diseño inspirado en el sitio de referencia proporcionado.
- Animaciones suaves.
- Tarjetas.
- Gradientes discretos.
- Tipografía moderna.
- Responsive.
- Microinteracciones.
- Estados de carga.
- Transiciones entre páginas.

No se copiará el diseño completo de la página institucional de la UPSJB.

El logo será el principal elemento institucional.

---

# 27. Hero principal

Concepto:

```text
                         [LOGO UPSJB]

                  SISTEMA DE INCIDENCIAS
                         FILIAL ICA

           Reporta y realiza seguimiento de incidencias
                    de manera rápida y sencilla.

                 [ REPORTAR INCIDENCIA ]

                 [ CONSULTAR INCIDENCIA ]
```

Debe existir una sección visual para explicar el uso del QR.

---

# 28. Página de reporte

Cuando el usuario llegue desde un QR:

```text
UPSJB
Sistema de Incidencias

📍 Filial Ica
🏢 Pabellón B
🚪 Aula B-104

Tipo de incidencia
[ Técnica ▼ ]

Problema
[ Monitor no enciende ▼ ]

Descripción
[.................................]

Prioridad
○ Baja
○ Media
○ Alta

📷 Adjuntar evidencia

[ ENVIAR REPORTE ]
```

El ambiente se obtiene automáticamente desde el QR.

---

# 29. Confirmación de reporte

Después de enviar:

```text
✓ Incidencia registrada

Tu reporte fue recibido correctamente.

Código:
INC-2026-00128

Estado:
PENDIENTE

[ CONSULTAR SEGUIMIENTO ]
```

---

# 30. Página de seguimiento

El usuario podrá consultar con el código:

```text
INC-2026-00128
```

Timeline:

```text
✓ Reportada
   ↓
✓ Recibida
   ↓
✓ Asignada
   ↓
● En proceso
   ↓
○ Resuelta
   ↓
○ Cerrada
```

---

# 31. Dashboard del técnico

Indicadores:

```text
INCIDENCIAS PENDIENTES
12

URGENTES
5

EN PROCESO
7

RESUELTAS
18
```

Lista:

```text
INC-2026-00124
Aula B-104
Monitor no enciende
Prioridad: Alta

[ VER INCIDENCIA ]
```

---

# 32. Vista de atención

El técnico deberá poder ver:

```text
Código
Ambiente
Tipo
Subtipo
Prioridad
Descripción
Equipo
Usuario
Fecha de reporte
Historial
Comentarios
Evidencias
SLA
```

Y podrá realizar:

```text
Aceptar
Iniciar atención
Agregar diagnóstico
Agregar comentario
Adjuntar evidencia
Registrar acción
Cambiar estado
Resolver
```

---

# 33. Dashboard administrativo

Menú:

```text
Dashboard
Incidencias
Usuarios
Roles y permisos
Sedes
Pabellones
Pisos
Ambientes
Aulas
Laboratorios
Equipos
Códigos QR
Áreas
Servicios
Técnicos
Especialidades
SLA
Notificaciones
Base de conocimiento
Reportes
Auditoría
Configuración
```

---

# 34. Dashboard analítico

Indicadores:

```text
Incidencias totales
Incidencias abiertas
Incidencias en proceso
Incidencias resueltas
Incidencias cerradas
Tiempo promedio de atención
Tiempo promedio de resolución
Incidencias por área
Incidencias por ambiente
Incidencias por categoría
Incidencias por equipo
```

Gráficos:

- Incidencias por tipo.
- Incidencias por prioridad.
- Incidencias por estado.
- Incidencias por área.
- Incidencias por ambiente.
- Incidencias por equipo.
- Evolución mensual.
- Tiempo promedio de atención.

---

# 35. Mapa/visualización de ambientes

Se podrá representar visualmente un pabellón:

```text
PABELLÓN B

┌────────┬────────┬────────┐
│ B-101  │ B-102  │ B-103  │
│  🟢    │  🟢    │  🔴    │
├────────┼────────┼────────┤
│ B-104  │ B-105  │ B-106  │
│  🟡    │  🟢    │  🟢    │
└────────┴────────┴────────┘
```

Esto puede evolucionar posteriormente hacia un plano interactivo real.

---

# 36. Clasificación automática

El sistema debe permitir configurar reglas.

Ejemplo:

```text
Si:
tipo = Técnica
subtipo = Internet

Entonces:
área = Sistemas
servicio = Redes
```

Otro:

```text
Si:
tipo = Infraestructura
subtipo = Puerta

Entonces:
área = Infraestructura
servicio = Mantenimiento
```

El administrador podrá modificar las reglas.

---

# 37. Evidencias

Cada incidencia podrá almacenar:

```text
Foto antes
Foto durante
Foto después
Documento
Video
```

Las imágenes se almacenarán en Supabase Storage y la base de datos conservará sus referencias.

---

# 38. Tiempo real

Supabase Realtime permitirá:

```text
Nueva incidencia
       ↓
Dashboard del técnico
       ↓
Actualización automática
```

No será necesario actualizar manualmente la página para recibir cambios compatibles con el canal de tiempo real.

---

# 39. Seguridad

## Autenticación

Supabase Auth.

## Autorización

Roles y permisos propios.

## RLS

Se aplicarán políticas de Row Level Security.

Ejemplo conceptual:

### Estudiante

```text
INSERT → incidencias
SELECT → sus incidencias
UPDATE → acciones permitidas
DELETE → no permitido
```

### Técnico

```text
SELECT → incidencias asignadas
UPDATE → incidencias que puede atender
```

### Coordinador

```text
SELECT → incidencias de su área
UPDATE → gestión operativa
```

### Administrador

Acceso administrativo según permisos.

---

# 40. Auditoría

Se registrarán acciones importantes:

```text
LOGIN
LOGOUT
CREAR
EDITAR
ASIGNAR
DERIVAR
CAMBIAR_ESTADO
ADJUNTAR_EVIDENCIA
RESOLVER
CERRAR
MODIFICAR_CONFIGURACION
```

Ejemplo:

```text
Administrador
    ↓
CAMBIO_ESTADO
    ↓
INC-2026-00124
    ↓
Pendiente → En proceso
```

---

# 41. Arquitectura de carpetas

Propuesta:

```text
sir-upsjb/
│
├── app/
│   ├── page.tsx
│   ├── reportar/
│   ├── seguimiento/
│   ├── login/
│   │
│   ├── tecnico/
│   │   ├── dashboard/
│   │   ├── incidencias/
│   │   └── perfil/
│   │
│   └── admin/
│       ├── dashboard/
│       ├── incidencias/
│       ├── usuarios/
│       ├── roles/
│       ├── sedes/
│       ├── pabellones/
│       ├── pisos/
│       ├── ambientes/
│       ├── aulas/
│       ├── laboratorios/
│       ├── equipos/
│       ├── qr/
│       ├── tecnicos/
│       ├── areas/
│       ├── servicios/
│       ├── sla/
│       ├── reportes/
│       └── auditoria/
│
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── incidencias/
│   ├── qr/
│   ├── equipos/
│   ├── graficos/
│   └── layout/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── permisos/
│   ├── incidencias/
│   └── notificaciones/
│
├── hooks/
├── types/
├── services/
├── utils/
│
└── supabase/
    ├── migrations/
    ├── seed/
    └── functions/
```

---

# 42. Fases de desarrollo

## FASE 0 — Investigación y validación

- Revisar documentación pública.
- Identificar áreas.
- Identificar ambientes.
- Definir categorías.
- Definir roles.
- Validar flujo con usuarios reales.
- Identificar reglas institucionales que necesitan aprobación.

**Resultado:** documento de requisitos.

---

## FASE 1 — Arquitectura

- Crear repositorio.
- Crear proyecto Next.js.
- Configurar TypeScript.
- Configurar Tailwind.
- Configurar componentes UI.
- Configurar Supabase.
- Configurar variables de entorno.
- Definir arquitectura.

**Resultado:** proyecto base funcionando.

---

## FASE 2 — Base de datos

- Crear migraciones.
- Crear tablas.
- Crear PK.
- Crear FK.
- Crear índices.
- Crear constraints.
- Crear triggers cuando sean necesarios.
- Crear funciones SQL.
- Crear políticas RLS.
- Crear datos iniciales.

**Resultado:** base de datos funcional.

---

## FASE 3 — Autenticación

- Login.
- Logout.
- Recuperación de contraseña.
- Perfil.
- Roles.
- Permisos.
- Protección de rutas.
- RLS.

**Resultado:** sistema de usuarios seguro.

---

## FASE 4 — QR

- Crear QR.
- Asociar QR con ambiente.
- Generar URL.
- Escanear QR.
- Registrar lectura.
- Deshabilitar QR.
- Regenerar QR.
- Descargar/imprimir QR.

**Resultado:** flujo QR funcional.

---

## FASE 5 — Incidencias

- Formulario.
- Categorías.
- Subcategorías.
- Prioridades.
- Adjuntos.
- Creación de ticket.
- Código único.
- Historial.
- Seguimiento.

**Resultado:** módulo central funcionando.

---

## FASE 6 — Técnico

- Dashboard.
- Lista.
- Filtros.
- Detalle.
- Asignación.
- Diagnóstico.
- Comentarios.
- Evidencias.
- Resolución.

**Resultado:** atención operativa.

---

## FASE 7 — Administración

- Usuarios.
- Roles.
- Permisos.
- Áreas.
- Servicios.
- Técnicos.
- Ambientes.
- Equipos.
- QR.
- Configuración.

**Resultado:** administración completa.

---

## FASE 8 — Derivación y SLA

- Reglas.
- Asignación automática.
- Derivación.
- Tiempos.
- SLA.
- Alertas.

**Resultado:** automatización operativa.

---

## FASE 9 — Notificaciones

- Notificaciones internas.
- Realtime.
- Plantillas.
- Correo.
- Preferencias.

**Resultado:** comunicación automática.

---

## FASE 10 — Analítica

- Dashboard.
- Gráficos.
- KPIs.
- Reportes.
- Exportación.
- Tendencias.

**Resultado:** módulo de gestión.

---

## FASE 11 — Auditoría y seguridad

- Auditoría.
- Logs.
- Revisión RLS.
- Validaciones.
- Protección de endpoints.
- Control de archivos.
- Revisión de permisos.

**Resultado:** sistema preparado para pruebas de seguridad.

---

## FASE 12 — UX/UI

- Animaciones.
- Responsive.
- Loading states.
- Skeletons.
- Empty states.
- Toasts.
- Modales.
- Confirmaciones.
- Accesibilidad.

**Resultado:** interfaz profesional.

---

## FASE 13 — Pruebas

### Pruebas funcionales

- Registro.
- Login.
- QR.
- Incidencias.
- Asignación.
- Derivación.
- Resolución.
- Cierre.

### Pruebas de seguridad

- RLS.
- Roles.
- Permisos.
- Acceso a rutas.
- Archivos.

### Pruebas de interfaz

- Desktop.
- Tablet.
- Android.
- Navegadores.

### Pruebas de rendimiento

- Consultas.
- Dashboard.
- Imágenes.
- Realtime.

---

# 43. MVP

La primera versión funcional no debe intentar implementar absolutamente todo.

## MVP Usuario

```text
Escanear QR
↓
Reportar
↓
Recibir código
↓
Consultar estado
```

## MVP Técnico

```text
Login
↓
Incidencias asignadas
↓
Aceptar
↓
Atender
↓
Resolver
```

## MVP Administrador

```text
Dashboard
↓
Incidencias
↓
Usuarios
↓
Ambientes
↓
QR
↓
Reportes básicos
```

---

# 44. Segunda versión

Después del MVP:

```text
SLA
Derivación automática
Notificaciones
Realtime
Equipos
Evidencias avanzadas
Auditoría
Encuestas
Base de conocimiento
Reportes avanzados
```

---

# 45. Tercera versión

Funciones futuras:

```text
Aplicación móvil
Push notifications
Integración con sistemas institucionales
Integración con correo institucional
Integración con Microsoft 365
Integración con otros servicios
Analítica avanzada
Predicción de mantenimiento
Mantenimiento preventivo
Planificación de recursos
```

Estas integraciones deberán realizarse únicamente cuando exista autorización y documentación técnica correspondiente.

---

# 46. Mantenimiento preventivo futuro

Una evolución importante será pasar de:

```text
Incidencia
→
Problema
→
Reparación
```

a:

```text
Historial
→
Detección de patrones
→
Mantenimiento preventivo
→
Menos fallas
```

Ejemplo:

Si un proyector genera múltiples incidencias:

```text
Proyector P-104
↓
5 incidencias
↓
3 meses
↓
Sistema genera alerta
↓
Revisión preventiva
```

---

# 47. Indicadores del sistema

Se podrán calcular:

### Operativos

- Total de incidencias.
- Incidencias pendientes.
- Incidencias en proceso.
- Incidencias resueltas.
- Incidencias cerradas.
- Incidencias por prioridad.

### Tiempo

- Tiempo promedio de respuesta.
- Tiempo promedio de atención.
- Tiempo promedio de resolución.
- Incidencias fuera de SLA.

### Ubicación

- Incidencias por sede.
- Incidencias por pabellón.
- Incidencias por piso.
- Incidencias por ambiente.

### Equipos

- Incidencias por equipo.
- Incidencias por categoría.
- Equipos con mayor número de incidencias.

### Áreas

- Incidencias por área.
- Incidencias derivadas.
- Tiempo de atención por servicio.

---

# 48. Principios de diseño

El sistema deberá cumplir:

1. **Simple para reportar.**
2. **Rápido para atender.**
3. **Claro para supervisar.**
4. **Seguro para administrar.**
5. **Trazable para auditar.**
6. **Escalable para otras sedes.**
7. **Responsive para dispositivos móviles.**
8. **Accesible para diferentes usuarios.**

---

# 49. Reglas de UX

No se debe obligar al usuario a llenar formularios innecesarios.

El QR ya proporciona:

```text
Sede
Pabellón
Piso
Ambiente
```

Por lo tanto, el usuario solo debe proporcionar información realmente necesaria.

El formulario debe priorizar:

```text
¿Qué pasó?
¿Dónde? → automático
¿Con qué? → si aplica
Foto → opcional
Prioridad → configurable
```

---

# 50. Estados visuales

Los estados deberán tener texto e iconos, no depender exclusivamente del color.

Ejemplo:

```text
🟡 PENDIENTE
🔵 ASIGNADA
🟠 EN PROCESO
🟣 EN ESPERA
🟢 RESUELTA
✓ CERRADA
```

Esto mejora la accesibilidad.

---

# 51. Diseño responsive

La aplicación debe diseñarse primero pensando en el usuario que escanea un QR desde un teléfono.

Prioridad:

```text
Mobile
   ↓
Tablet
   ↓
Desktop
```

El dashboard administrativo tendrá una experiencia optimizada para escritorio, pero deberá seguir siendo usable en pantallas pequeñas.

---

# 52. Identidad visual

Se utilizará:

- Logo oficial de la UPSJB.
- Estética del sitio de referencia.
- Diseño moderno.
- Espaciado amplio.
- Tarjetas.
- Animaciones suaves.
- Iconografía consistente.
- Tipografía moderna.
- Elementos institucionales únicamente donde aporten identidad.

No se copiará la página institucional completa.

---

# 53. Estructura de navegación

## Público

```text
Inicio
Reportar incidencia
Consultar incidencia
Información
```

## Usuario autenticado

```text
Inicio
Mis incidencias
Notificaciones
Perfil
```

## Técnico

```text
Dashboard
Mis incidencias
Incidencias en proceso
Historial
Perfil
```

## Administrador

```text
Dashboard
Incidencias
Usuarios
Infraestructura
Equipos
QR
Organización
Configuración
Reportes
Auditoría
```

---

# 54. Reglas importantes de negocio

## Regla 1

Una incidencia debe tener un código único.

Ejemplo:

```text
INC-2026-000001
```

## Regla 2

Una incidencia debe tener un estado.

## Regla 3

Una incidencia no debería cerrarse sin resolución registrada.

## Regla 4

Los cambios importantes deben quedar en historial.

## Regla 5

Una incidencia técnica puede asignarse a Sistemas.

## Regla 6

Una incidencia no técnica debe poder derivarse al área correspondiente.

## Regla 7

Una incidencia asociada a un equipo debe mantener el historial del equipo.

## Regla 8

Los usuarios solo pueden realizar las acciones permitidas por su rol.

## Regla 9

Los QR deben ser únicos.

## Regla 10

Las reglas de clasificación deben ser configurables.

---

# 55. Ejemplo completo

Usuario encuentra:

> Monitor sin señal en B-104.

### Paso 1

Escanea:

```text
QR-ICA-B-B104
```

### Paso 2

El sistema identifica:

```text
Filial Ica
Pabellón B
Piso 1
Aula B-104
```

### Paso 3

Usuario selecciona:

```text
Tipo:
Técnica

Subtipo:
Monitor sin señal
```

### Paso 4

Describe:

```text
El monitor de la PC 12 no muestra imagen.
```

Adjunta fotografía.

### Paso 5

Sistema crea:

```text
INC-2026-000128
```

### Paso 6

Regla automática:

```text
Técnica
+
Monitor
↓
Sistemas
```

### Paso 7

Coordinador asigna:

```text
Técnico:
Carlos
```

### Paso 8

Carlos registra:

```text
Diagnóstico:
Cable HDMI defectuoso.

Acción:
Reemplazo del cable.

Resultado:
Monitor operativo.
```

### Paso 9

Estado:

```text
Resuelta
```

### Paso 10

Usuario recibe:

```text
La incidencia INC-2026-000128 fue resuelta.
```

### Paso 11

Usuario confirma.

### Paso 12

Sistema:

```text
CERRADA
```

### Paso 13

La información pasa a estadísticas.

---

# 56. Fuentes institucionales de referencia

Para la planificación inicial se debe considerar la información pública de la UPSJB sobre:

- Locales y filiales.
- Organización institucional.
- Servicios de atención.
- Infraestructura.
- Sistemas y servicios digitales.

Fuentes:

- UPSJB: https://www.upsjb.edu.pe/
- Locales y filiales: https://www.upsjb.edu.pe/locales-y-filiales/
- Servicio de Atención al Estudiante: https://www.upsjb.edu.pe/servicio-atencion-estudiante/
- Documento público de infraestructura 2024: https://www.upsjb.edu.pe/wp-content/uploads/2025/05/OBRAS-DE-INFRAESTRUCTURA-2024.pdf
- Referencia visual proporcionada: https://rococo-lebkuchen-fddb8f.netlify.app/

Estas fuentes sirven como referencia pública para el diseño. Los procesos internos, responsables, tiempos de atención, nombres definitivos de áreas, inventario de ambientes y políticas de servicio deberán validarse directamente con la Filial Ica.

---

# 57. Entregables del proyecto

Al finalizar el proyecto se espera contar con:

```text
01. Aplicación web
02. Base de datos PostgreSQL
03. Autenticación
04. Sistema de roles
05. Sistema de permisos
06. Gestión de ambientes
07. Gestión de equipos
08. Generador QR
09. Registro de incidencias
10. Clasificación
11. Asignación
12. Derivación
13. Seguimiento
14. Evidencias
15. Historial
16. SLA
17. Notificaciones
18. Dashboard técnico
19. Dashboard administrativo
20. Reportes
21. Auditoría
22. Encuestas
23. Base de conocimiento
24. Documentación técnica
25. Diccionario de datos
26. Diagrama ER
27. Scripts SQL
28. Políticas RLS
29. Manual de usuario
30. Manual administrativo
```

---

# 58. Orden recomendado de construcción

El orden definitivo será:

```text
1. Requisitos
       ↓
2. Arquitectura
       ↓
3. Modelo ER
       ↓
4. Diccionario de datos
       ↓
5. Migraciones Supabase
       ↓
6. RLS
       ↓
7. Auth
       ↓
8. Diseño UI
       ↓
9. QR
       ↓
10. Incidencias
       ↓
11. Técnico
       ↓
12. Administrador
       ↓
13. Derivación
       ↓
14. SLA
       ↓
15. Notificaciones
       ↓
16. Reportes
       ↓
17. Auditoría
       ↓
18. Pruebas
       ↓
19. Optimización
       ↓
20. Deploy
```

---

# 59. Objetivo final

El resultado esperado es una plataforma donde la universidad pueda pasar de un modelo de comunicación informal:

```text
"Profesor avisa que algo está mal"
```

a un proceso digital:

```text
INC-2026-000128

Aula B-104
       ↓
Monitor
       ↓
Incidencia técnica
       ↓
Prioridad Alta
       ↓
Sistemas
       ↓
Técnico asignado
       ↓
Diagnóstico
       ↓
Solución
       ↓
Confirmación
       ↓
Cierre
       ↓
Estadística
```

La plataforma debe ser suficientemente sencilla para que un estudiante pueda reportar un problema en segundos, pero suficientemente estructurada para que un administrador pueda analizar toda la operación.

---

# 60. Próximo documento técnico

El siguiente paso después de este Plan Maestro será crear:

## `01-DISENO-BASE-DATOS-SIR-UPSJB.md`

Debe contener:

- Las 58 tablas.
- Todos los campos.
- Tipos de datos.
- PK.
- FK.
- Relaciones.
- Cardinalidades.
- Índices.
- Constraints.
- Valores por defecto.
- ENUM/check constraints.
- Triggers.
- Funciones PostgreSQL.
- Políticas RLS.
- Datos iniciales.
- Diagrama entidad-relación.
- Orden de creación de tablas.
- Estrategia de migraciones.
- Estrategia de auditoría.

Después se podrá construir:

```text
02-ARQUITECTURA-SISTEMA.md
03-ROLES-Y-PERMISOS.md
04-REQUISITOS-FUNCIONALES.md
05-API-Y-SERVICIOS.md
06-DISENO-UI-UX.md
07-PLAN-DE-DESARROLLO.md
08-PLAN-DE-PRUEBAS.md
09-DEPLOYMENT.md
10-MANUAL-USUARIO.md
```

---

## Conclusión

SIR-UPSJB se plantea como un sistema modular de gestión de incidencias, inicialmente orientado a la Filial Ica, con arquitectura preparada para crecer a otras sedes.

La base de datos estará diseñada de manera relacional y normalizada, con más de 30 tablas y una propuesta inicial de 58 tablas lógicas distribuidas entre usuarios, infraestructura, equipos, QR, incidencias, organización, SLA, notificaciones, satisfacción, conocimiento, auditoría y reportes.

La prioridad de desarrollo será mantener un flujo sencillo para el usuario:

**Escanear QR → Reportar → Seguimiento**

mientras que el personal encargado dispondrá de herramientas para:

**Clasificar → Asignar → Atender → Derivar → Resolver → Auditar → Analizar.**

El sistema deberá diferenciar claramente entre las funcionalidades diseñadas como propuesta tecnológica y los procedimientos oficiales de la UPSJB, los cuales deben ser validados institucionalmente antes de una implementación real.
