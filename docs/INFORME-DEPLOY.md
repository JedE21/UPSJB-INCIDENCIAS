# INFORME DE DEPLOY · SIR-UPSJB

**Fecha:** 20 de septiembre de 2026
**Alcance:** Despliegue inicial a producción (Plan Maestro — fases 1 a 10 completadas)

---

## 1. URL de producción

| Elemento | Valor |
|---|---|
| URL definitiva | **https://sir-upsjb.vercel.app** |
| Dominio institucional | **PENDIENTE** — configurar en Vercel → Settings → Domains cuando la institución asigne el dominio definitivo (ej. `incidencias.upsjb.edu.pe`). Tras asignarlo, actualizar `NEXT_PUBLIC_SITE_URL` en Vercel y las Redirect URLs de Supabase Auth. |

## 2. Arquitectura desplegada

| Capa | Proveedor | Estado |
|---|---|---|
| Frontend | Vercel (proyecto `sir-upsjb`, cuenta `jede21`) | ✅ Operativo |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) | ✅ Operativo |
| Repositorio | GitHub — `JedE21/UPSJB-INCIDENCIAS` (rama `main`) | ✅ Conectado a Vercel (deploy automático por push) |

## 3. Estado por componente

- **Frontend:** ✅ Build exitoso (Next.js 16, rutas estáticas y dinámicas correctas, middleware/proxy activo). Typecheck `tsc --noEmit` sin errores.
- **Supabase:** ✅ Conectividad verificada en producción (RPC `registrar_lectura_qr` ejecutó INSERT real).
- **Auth:** ✅ Email provider + hook `custom_access_token_hook` (migración 0010) según diseño. **Verificación pendiente por el usuario:** en Supabase Dashboard → Authentication → URL Configuration, confirmar que las Redirect URLs incluyan `https://sir-upsjb.vercel.app/**` (además de `http://localhost:3000/**`).
- **Storage:** ✅ Buckets privados `evidencias` y `reportes` con 8 policies (0009); acceso solo por signed URLs.
- **Realtime:** ✅ Publication `supabase_realtime` con tabla `public.notificaciones` (0018).
- **RLS:** ✅ Habilitado masivamente sobre todas las tablas públicas (0007 vía bloque `DO`), guardas anti-abuso (0008), políticas por tabla (0007/0009) y verificación integral (0020).
- **Migraciones:** ✅ 0001–0020 completas en `supabase/migrations/`. Script combinado `aplicar_migraciones_supabase.sql` disponible.
- **Variables de entorno (Vercel, Production):** ✅ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL=https://sir-upsjb.vercel.app` (todas tipo Config, públicas por diseño). **No existe ninguna service_role key** ni en el código ni en el entorno — por diseño del proyecto.

## 4. Comprobaciones previas ejecutadas

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Repositorio limpio | ✅ tras commit `0d2be55` (133 archivos de las fases aprobadas) |
| 2 | `git status` | ✅ limpio |
| 3 | `.gitignore` | ✅ `.env*` ignorado salvo `.env.example` |
| 4 | Secretos | ✅ Sin JWTs ni claves duras en código/SQL/docs |
| 5 | `.env.local` no versionado | ✅ Verificado con `git check-ignore` |
| 6 | Service role en cliente | ✅ Ausente (solo menciones documentales de prohibición) |
| 7 | Lint | ⚠️ No hay ESLint configurado en el proyecto (sin config ni script). Pendiente institucional. |
| 8 | Typecheck | ✅ Sin errores |
| 9 | Build | ✅ Exitoso |
| 10–11 | Migraciones y RLS | ✅ (detalle arriba) |
| 12–13 | Storage y Auth | ✅ / ⚠️ Redirect URLs por confirmar en Dashboard |
| 14–15 | Variables y URLs de producción | ✅ |

## 5. Pruebas ejecutadas (post-deploy, automatizables)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Página inicial | ✅ 200, `<title>SIR-UPSJB · Sistema de Incidencias</title>` |
| 3 | Rutas protegidas sin sesión | ✅ Redirect a `/login?siguiente=…` (admin, mis-incidencias, técnico) |
| 4 | QR | ✅ PNG 200 (`image/png`); `/r/<codigo>` con pantalla amable de "no encontrada"; lectura POST `{"ok":true}` con INSERT real en BD |
| 5 | Reporte | ✅ 200, flujo QR-primero renderiza (catálogos cargan tras escanear ambiente) |
| 7 | Seguimiento | ✅ 200 con buscador por código |
| — | Secretos en HTML/bundle servido | ✅ Cero coincidencias de service_role |
| — | Endpoint con formato inválido | ✅ 400 con mensaje controlado (sin fuga de stack) |

**Problemas encontrados y resueltos durante el deploy:**
1. Push a `upsjbincidencias-dotcom/UPSJB-INCIDENCIAS` → 403 (credencial local `JedE21` sin permiso). **Resolución según decisión del usuario:** se creó/usó el repo `JedE21/UPSJB-INCIDENCIAS` y Vercel de `jede21`. El repo institucional queda **sin el commit final** hasta resolver permisos.
2. `vercel env add` con CLI 59 abre prompt interactivo para valores tipo JWT → la variable no se guardaba con stdin pipeado. **Resolución:** `--value` + `--no-sensitive` + `--yes` (modo no interactivo).

## 6. Pruebas pendientes (requieren sesión real — validación del usuario)

La prueba end-to-end completa **QR → ambiente → reporte → incidencia → asignación → técnico → atención → resolución → confirmación → cierre → estadísticas → auditoría** requiere iniciar sesión con usuarios reales (el alta de usuarios se hace desde el panel admin). Usar como guía `docs/MATRIZ-PRUEBAS.md`:

- [ ] Login / Logout con usuario admin real
- [ ] Escaneo QR de un ambiente real → formulario de reporte con catálogos cargados
- [ ] Creación de incidencia → código `INC-<AAAA>-<NNNNNN>` recibido
- [ ] Seguimiento público por código
- [ ] Asignación a técnico (admin) → atención (técnico) → resolución → confirmación del reportante → cierre
- [ ] Dashboard técnico y administrativo con datos
- [ ] Notificaciones en vivo (Realtime, dos navegadores)
- [ ] Subida de evidencias (Storage + signed URLs)
- [ ] Reportes estadísticos y CSV
- [ ] Auditoría de seguridad (0020) — `docs/verificacion-admin.sql`

## 7. Problemas pendientes

1. **Repo institucional desactualizado:** `upsjbincidencias-dotcom/UPSJB-INCIDENCIAS` no recibió el commit `0d2be55` (403). Pendiente: agregar a `JedE21` como colaborador o cambiar credencial local.
2. **Redirect URLs de Supabase Auth:** confirmar `https://sir-upsjb.vercel.app/**` en el Dashboard.
3. **Dominio institucional:** pendiente de asignación por UPSJB (ver §1).
4. **ESLint:** no configurado; añadir `eslint-config-next` como mejora de mantenimiento.
5. **Validación institucional pendiente (Filial Ica):** procedimientos, responsables, tiempos, nombres definitivos de áreas, inventario de ambientes y políticas de servicio — sin datos inventados en producción.
6. **Correo transaccional:** no configurado por diseño (FASE 9 espera aprobación de proveedor institucional).

## 8. Recomendaciones de mantenimiento

- **Backup:** activar PITR/backups automáticos en Supabase (Settings → Database).
- **Monitoreo:** revisar periódicamente Vercel Analytics/logs y Supabase Logs (API, Auth, Storage).
- **Rate limiting:** evaluar reglas de Auth (Supabase) y protección de rutas públicas si hay abuso.
- **Rotación:** rotar la anon key solo si se compromete (es pública por diseño; la seguridad es RLS+Auth).
- **Migraciones:** aplicar futuras migraciones en orden y versionarlas en `supabase/migrations/`; nunca editar una ya aplicada.
- **Dominio:** al configurar el dominio institucional, actualizar `NEXT_PUBLIC_SITE_URL` y Redirect URLs, y reimprimir QR solo si se usó el dominio temporal en el contenido impreso (el diseño usa URL estable `/r/<codigo>` para minimizarlo).
- **Evolución futura (NO implementada, según Plan Maestro):** app móvil, push notifications, integraciones institucionales, Microsoft 365, analítica predictiva, mantenimiento preventivo.

---

*Generado por Buffy (Freebuff) — 20/09/2026. Detenido para revisión final del usuario.*
