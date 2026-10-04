# Seguridad operativa

Fecha de corte: 4 de octubre de 2026, `America/Guayaquil`.

Este documento registra una revisión acotada de la aplicación `Voces de Esperanza` en Coolify. No es una auditoría absoluta del servidor, de Cloudflare, del proveedor S3 ni de otros proyectos. No contiene valores de credenciales, datos personales ni contenido financiero.

## Alcance y resultado

Se revisaron Coolify v4.3.23, la aplicación, su PostgreSQL, las variables efectivas, el método de construcción, previews, fuente Git, logs de despliegue disponibles, Dockerfile, respaldos y consumidores conocidos. No se modificaron DNS, otros proyectos ni configuración global compartida.

| Nombre | Finalidad | Ámbito necesario | Ámbito encontrado | Clasificación y evidencia sanitizada | Corrección | Verificación |
| --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Conexión de Prisma con PostgreSQL | Runtime | Runtime y argumento de build automático | **Confirmada**: un despliegue anterior la incluyó entre los argumentos generados por Coolify | Se desactivó buildtime, se rotó la contraseña efectiva del rol PostgreSQL y se sincronizaron motor, aplicación y respaldo | Conexión nueva aceptada por PostgreSQL; respaldo posterior a la rotación `Success`; valor exacto privado solo runtime |
| `BETTER_AUTH_SECRET` | Firma de cookies y sesiones | Runtime | Runtime y argumento de build automático | **Confirmada**: presente como argumento en el log de construcción revisado | Se desactivó buildtime, se rotó y se revocaron las sesiones del coro | Valor exacto privado solo runtime; una sesión revocada; usuarios y contraseñas personales conservados |
| `QR_SIGNING_SECRET` | Firma de QR temporales de asistencia | Runtime | Runtime y argumento de build automático | **Confirmada**: presente como argumento en el log de construcción revisado | Se desactivó buildtime y se rotó | Valor exacto privado solo runtime; los QR emitidos con la clave anterior quedaron inválidos |
| `CRON_SECRET` | Autorización del endpoint de recurrencia | Runtime | Runtime y argumento de build automático | **Confirmada**: presente como argumento en el log de construcción revisado | Se desactivó buildtime y se rotó | Valor exacto privado solo runtime; Coolify no tiene una tarea programada configurada, por lo que no había otro consumidor que actualizar |
| Variables públicas de configuración | URL, zona horaria, tamaño máximo y opciones no secretas | Runtime salvo necesidad justificada | Runtime y argumento de build automático | **Sin hallazgo de credencial**, pero con alcance excesivo | Las 11 variables de la aplicación quedaron fuera del build y disponibles en runtime | El comando de build corregido solo contiene argumentos propios de Coolify |
| Variables heredadas o previews | Posible reinyección fuera de la lista local | Ninguna para secretos del coro | No se encontraron variables administradas/heredadas; previews deshabilitados | **Sin hallazgo en el alcance revisado** | No se habilitaron previews ni variables compartidas | Lista local revisada, previews deshabilitados y nueva construcción inspeccionada |
| Metadatos y capas de la imagen final | Posible persistencia de secretos | Sin secretos productivos | Docker multi-stage con valores sintéticos exclusivos del builder | **Sin hallazgo en el alcance revisado** | Se conservan placeholders que no autentican en producción; la etapa final recibe la configuración al arrancar | Dockerfile y argumentos efectivos revisados; no se pasaron los cuatro secretos al build corregido |
| Logs y caché previos | Persistencia histórica del incidente | Acceso restringido | El log anterior conserva el comando afectado | **Posible** exposición residual a administradores de Coolify y almacenamiento interno de logs/caché | Se rotaron los cuatro valores; no se hizo prune global ni se borró auditoría | Las credenciales anteriores ya no autentican; la evidencia histórica se mantiene restringida |
| Puerto PostgreSQL | Evitar acceso directo externo | Red privada | Recurso marcado privado; existe un mapeo interno en Coolify | **Sin hallazgo de exposición externa** en la prueba realizada | No se habilitó acceso público | La conexión TCP externa al puerto mapeado expiró; esto no sustituye una auditoría completa de firewall |

Ningún secreto del servidor usa el prefijo `NEXT_PUBLIC_`. Los placeholders sintéticos del Dockerfile no son credenciales productivas y la imagen no consulta la base real durante `next build`.

## Impacto y revocación

- PostgreSQL: la contraseña se cambió en el motor, se comprobó una conexión nueva y se sincronizó en Coolify, la aplicación y el proceso de respaldo.
- Autenticación: Better Auth usa el secreto para firmar cookies. La rotación no altera el hash de la contraseña ni la identidad del SUPERADMIN. Se eliminó exactamente una sesión existente del coro, por lo que es necesario iniciar sesión otra vez.
- Asistencia: los QR anteriores a la rotación dejan de verificar. Los QR son temporales y se deben regenerar desde un usuario autenticado.
- Tareas: el endpoint requiere `CRON_SECRET`, pero no existe una tarea programada en Coolify. Abrir asistencia conserva la recuperación funcional documentada; si se crea una tarea, debe leer el secreto del entorno y no incluirlo literalmente en el comando.
- Rollback: una imagen anterior puede volver a ejecutarse con la configuración runtime vigente, pero no se deben restaurar las credenciales revocadas.

## Construcción y despliegue

- Fuente efectiva: integración `Public GitHub` sobre `georgenton/coro-voces-esperanza`, rama `main`. Existe una GitHub App disponible en Coolify, pero no está seleccionada para este recurso.
- No se encontró un webhook de repositorio configurado y los merges previos no produjeron un despliegue automático verificable.
- Se eligió **despliegue manual controlado**. La opción engañosa de auto deploy quedó en `Manual deployments only`.
- La inyección automática de argumentos quedó en `Managed manually in Dockerfile`.
- Las 11 variables locales de la aplicación están disponibles en runtime y no en buildtime. No se reemplazó el entorno completo.
- Los preview deployments y su control de acceso están deshabilitados; la PR visual no se desplegó.

Un primer redespliegue de la rotación falló el healthcheck y Coolify volvió automáticamente al contenedor anterior. La causa fue una asignación incorrecta de `DATABASE_URL` durante la edición, detectada por `P1013`. Se corrigió cada variable de forma individual y se comprobó por comparación privada exacta antes de repetir el despliegue. El incidente no creó ni promovió datos.

## Respaldo y recuperación

- PostgreSQL: ejecución diaria a las 03:00, `America/Guayaquil`; copia local y en `SyntaVera R2 Backups`; retención local y S3 de 14 copias/14 días; alerta de respaldo faltante después de 26 horas.
- `/data/uploads`: ejecución diaria a las 03:05; el contenedor se detiene durante el archivo para consistencia; copia local y S3; retención local y S3 de 14 copias/14 días.
- Después de rotar PostgreSQL se creó un dump custom nuevo de 109.44 KB con estado `Success` y disponibilidad `Local` + `S3`.
- El archivo descargado se restauró con `--exit-on-error` en PostgreSQL 17 dentro de un contenedor temporal, sin red y con almacenamiento en memoria. Resultado agregado: 42 tablas, 1 usuario, y cero miembros, cargos, movimientos, partes de pago, asignaciones, adjuntos, filas importadas y sesiones.
- El archivo de `/data/uploads` midió 137 B: no existen adjuntos productivos. El procedimiento completo con un adjunto sintético ya se probó por separado el 1 de octubre.

Coolify confirmó que el objeto existe en R2, pero el botón de descarga de una ejecución disponible tanto localmente como en S3 no informa cuál copia atendió la descarga. Por ello, la restauración independiente **desde R2 sin depender de la copia local** continúa como evidencia pendiente. No se afirma recuperación total ante pérdida del host.

`SyntaVera R2 Backups` es un bucket compartido con otros recursos de SyntaVera; Coolify separa los objetos por ruta de equipo/recurso, pero no se comprobó un bucket ni un principal exclusivo del coro. Tampoco se auditó de forma independiente la política de cifrado del proveedor. No se encontró un enlace público del objeto y las credenciales permanecen ocultas, pero el aislamiento y privilegio mínimo a nivel de bucket siguen pendientes de una decisión global autorizada.

El detector de respaldo faltante de PostgreSQL está configurado a 26 horas. Sin embargo, los seis canales globales de notificación disponibles en Coolify están deshabilitados y el respaldo de volumen no ofrece en esta versión un umbral equivalente. No se cambió esa configuración compartida; por tanto, los fallos quedan visibles en Coolify pero no existe un aviso saliente comprobado.

## Preflight manual mínimo

1. Confirmar que la PR o commit de `main` tiene CI aprobado y que no incluye una rama visual pendiente.
2. Registrar el SHA exacto y revisar migraciones, Dockerfile, variables runtime-only y respaldos recientes.
3. Ejecutar `Redeploy` en Coolify, sin cambiar DNS ni usar `Redeploy without cache` salvo causa documentada.
4. Verificar commit, estado `Success`, health interno, `/api/health`, consulta real a PostgreSQL, acceso autenticado y respaldo posterior cuando haya rotación de base.
5. Ante fallo, conservar logs, dejar que el rolling update retire el contenedor no saludable y corregir configuración sin reactivar secretos anteriores.
