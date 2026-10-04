# Despliegue en Coolify

La aplicación se publicó el 1 de octubre de 2026 como una instancia Next.js y una base PostgreSQL separada. URL canónica: `https://coro.syntavera.dev`. El registro DNS ya existente apuntaba al servidor de Coolify, por lo que no se modificó Cloudflare. `main` contiene los datos e informes aprobados en el PR 6; la interfaz de la PR 7 sigue abierta, sin desplegar.

## Estado de producción verificado

- Proyecto Coolify: `Voces de Esperanza` (`curszcfgrj5qgqoalyjpjfx1`), entorno `production` (`hqjrkmlxe1xybokuktovevmb`).
- Aplicación: `voces-esperanza-app` (`qwag6glb0gc6jfzlfwa46fi4`), rama `main`, commit funcional desplegado `b0a71f3974e6cf8969e6c7e4244e64d645733263`.
- PostgreSQL 17 privado: `voces-postgres` (`cw9lgsmko0t2rnramfsrqmrm`), base `voces_esperanza`, sin puerto público.
- Volumen de adjuntos: `qwag6glb0gc6jfzlfwa46fi4-voces-uploads` en `/data/uploads`.
- HTTPS externo: `/api/health` respondió 200 con `{"status":"healthy"}`, `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow`.
- Migraciones en producción: 4 aplicadas y al día para el commit desplegado.
- Estado agregado comprobado mediante el respaldo posterior a la rotación: 1 usuario administrador y 0 sesiones, miembros, filas importadas, cargos, partes de pago, aplicaciones, movimientos y adjuntos. Los catálogos base permanecen separados.
- La imagen final incluye `curl` para el healthcheck interno de Coolify. El primer intento sin esa dependencia falló de forma segura y Coolify retiró el contenedor no saludable; el segundo quedó `healthy`.
- El PR 4 añadió el bootstrap interactivo del SUPERADMIN. Coolify desplegó el merge `786d8aa` en 3m48s con estado `Success`; después `/api/health` respondió 200 por HTTPS con `no-store` y `noindex`. El SUPERADMIN ya fue activado en el flujo privado.

## 1. Recursos

1. Crear un recurso PostgreSQL privado en Coolify. No publicar su puerto.
2. Crear una aplicación desde este repositorio usando `Dockerfile`.
3. Montar un volumen persistente en `/data/uploads` para comprobantes e importaciones.
4. Asignar al contenedor al menos 512 MiB de memoria y el puerto interno `3000`.

## 2. Variables requeridas

Definir en Coolify, sin guardarlas en Git:

- `DATABASE_URL`: URL interna de PostgreSQL con TLS cuando corresponda.
- `APP_BASE_URL=https://coro.syntavera.dev`.
- `BETTER_AUTH_SECRET`: aleatorio de 32 bytes o más.
- `QR_SIGNING_SECRET`: aleatorio e independiente.
- `CRON_SECRET`: aleatorio e independiente.
- `PRIVATE_UPLOAD_DIR=/data/uploads`.
- `APP_TIMEZONE=America/Guayaquil`.
- `AI_VISION_PROVIDER=disabled` hasta aprobar privacidad y proveedor.

La aplicación falla de forma segura si faltan base de datos o secretos. No hay contraseña demo de producción.

En Coolify todas las variables de esta aplicación deben quedar disponibles en runtime y no en buildtime. La inyección automática de argumentos de build está deshabilitada. Consultar `docs/SEGURIDAD-OPERATIVA.md` para la revisión sanitizada y la rotación del 4 de octubre.

## 3. Construcción y migraciones

El contenedor usa Node.js 24.21.0, compila salida standalone y ejecuta `prisma migrate deploy` antes de iniciar `server.js`. El usuario del proceso no es root.

Si una recuperación autorizada exige recrear el primer acceso y no existe ya un SUPERADMIN, se usa desde la consola privada del contenedor:

```bash
./node_modules/.bin/tsx prisma/bootstrap-admin.ts
```

El comando solicita nombre y correo, comprueba el estado actual y solo entonces pide dos veces una contraseña de 12 a 128 caracteres sin mostrarla. La contraseña no viaja en argumentos, variables persistentes ni historial. Si la misma cuenta ya está activa, conserva contraseña y sesiones; si existe otra cuenta SUPERADMIN o el correo ya pertenece a una cuenta sin ese rol, termina sin elevar ni modificar usuarios. Nunca crea una ficha de miembro. No ejecutarlo rutinariamente: producción ya tiene administración activa.

No registrar la contraseña en Git, documentación, Notion, tickets, capturas o trazas. El seed nunca lee `private/` y los miembros ficticios están desactivados salvo que `SEED_SYNTHETIC_DATA=true` se configure explícitamente; no habilitarlo en producción.

## 4. Dominio y proxy

Coolify usa `coro.syntavera.dev` con HTTPS, redirección desde HTTP y cabecera `X-Robots-Tag: noindex, nofollow`. La zona aprobada es `syntavera.dev`; `cintavera.dev` no pertenece al alcance de esta aplicación. El proxy conserva `Host`, `X-Forwarded-Proto` y la IP de origen. No habilitar caché compartida para rutas autenticadas ni adjuntos.

El healthcheck es `GET /api/health`. Solo responde saludable cuando PostgreSQL acepta consultas.

## 5. Tarea programada

Después de configurar día y hora desde la aplicación, se puede programar una llamada diaria:

```bash
curl --fail --request POST 'https://coro.syntavera.dev/api/cron/rehearsals' \
  --header "Authorization: Bearer ${CRON_SECRET}"
```

La tarea es idempotente. Abrir el módulo de asistencia también recupera sesiones faltantes si la tarea no corrió.

Al 4 de octubre no existe una tarea programada en Coolify. Si se crea, el comando debe leer `CRON_SECRET` del entorno del contenedor; no debe copiar el valor literal a la tarea, documentación o logs.

## 6. Respaldo y restauración

Respaldar PostgreSQL y el volumen `/data/uploads` en el mismo punto de corte. Ejemplo de base:

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" > voces.dump
pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" voces.dump
```

Restaurar primero en un PostgreSQL separado, montar una copia del volumen y comprobar:

1. `/api/health` responde 200;
2. un usuario autorizado inicia sesión;
3. un adjunto de prueba se descarga con permisos;
4. cargos, aplicaciones y movimientos mantienen los mismos conteos;
5. la aplicación no apunta a la base de producción durante la prueba.

En Coolify quedó habilitado el respaldo de `voces_esperanza` a las 03:00 `America/Guayaquil`, con copia local y en `SyntaVera R2 Backups`, retención de 14 copias/14 días en ambos destinos y detector de ausencia después de 26 horas. Después de rotar la credencial del motor, una ejecución manual terminó `Success`, tamaño 109.44 KB y disponibilidad local + S3. Los canales salientes globales están deshabilitados, así que el detector todavía no produce una notificación comprobada.

El volumen `/data/uploads` se respalda a las 03:05, deteniendo el contenedor durante el archivo para obtener un corte consistente. Conserva 14 copias/14 días localmente y en el mismo destino S3. La primera ejecución terminó `Success`, tamaño 137 B, lo que concuerda con cero adjuntos productivos.

El destino R2 es compartido por otros recursos de SyntaVera y separa al coro por ruta, no mediante un bucket/principal dedicado. Cambiar el alcance de credenciales o activar notificaciones requiere una decisión sobre configuración global compartida y no se realizó en esta intervención.

## 7. Evidencia del simulacro aislado

El 1 de octubre de 2026 se probó la imagen local del commit `e0065642b3fff6c77ee459a1e3db9dde2358eb23` (`voces-esperanza:e006564`, digest local `sha256:8b108e710da7c8293fa7b7e267e206deffffba9033fdfc3a9cf30ddabe925684`) con PostgreSQL 17 y dos volúmenes exclusivos de prueba.

- Migraciones: 3 aplicadas; health 200.
- Datos sintéticos: 4 miembros, 1 usuario y 1 adjunto.
- Reinicio y recreación de ambos contenedores con los mismos volúmenes: conteos y SHA-256 del adjunto sin cambios.
- Respaldo fuera de contenedores: dump PostgreSQL custom y archivo comprimido del volumen.
- Restauración: PostgreSQL, volumen y aplicación nuevos, sin apuntar al origen.
- Resultado restaurado: health 200; mismos conteos; adjunto con SHA-256 `4222f014…`, propietario `1001:1001`, modo `600`; inicio de sesión sintético y descarga autorizada con `Cache-Control: private, no-store`.

El respaldo del simulacro permanece en el mismo equipo; prueba el procedimiento, no resiliencia ante pérdida completa del servidor. En producción debe copiarse a almacenamiento externo aprobado y probarse periódicamente en recursos separados.

El 4 de octubre se descargó el dump real posterior a la rotación y se restauró con PostgreSQL 17 en un contenedor temporal, sin red y con almacenamiento en memoria. `pg_restore --exit-on-error` terminó correctamente y se comprobaron 42 tablas y conteos agregados coherentes con el estado vacío de datos operativos. El mismo registro de Coolify figura `Local Available` y `S3 Available`; como el botón no informa cuál origen atendió la descarga, todavía falta repetir el simulacro forzando la lectura desde R2 después de una pérdida simulada de la copia local.

## 8. Despliegue manual controlado

Este recurso usa la fuente `Public GitHub`; la GitHub App disponible no está seleccionada y no se confirmó un webhook activo. Los merges anteriores tampoco acreditaron auto despliegue. Se configuró `Manual deployments only` y se deshabilitó la inyección automática de variables como argumentos del build.

Procedimiento:

1. comprobar CI del SHA de `main` y registrar el commit;
2. confirmar respaldo reciente y variables runtime-only;
3. ejecutar `Redeploy` en Coolify;
4. verificar commit, estado `Success`, health interno, health HTTPS y consulta real a PostgreSQL;
5. conservar logs y usar el rollback automático de rolling update si el contenedor nuevo no queda saludable.

No desplegar previews ni la PR 7 hasta aprobación visual explícita. Un despliegue aceptado por Coolify no sustituye estas comprobaciones.
