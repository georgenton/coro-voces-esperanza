# Despliegue en Coolify

La aplicación está preparada para una sola instancia Next.js y una base PostgreSQL separada. Este documento no confirma que el VPS, DNS o secretos existan. No se ha publicado producción ni modificado DNS.

## 1. Recursos

1. Crear un recurso PostgreSQL privado en Coolify. No publicar su puerto.
2. Crear una aplicación desde este repositorio usando `Dockerfile`.
3. Montar un volumen persistente en `/data/uploads` para comprobantes e importaciones.
4. Asignar al contenedor al menos 512 MiB de memoria y el puerto interno `3000`.

## 2. Variables requeridas

Definir en Coolify, sin guardarlas en Git:

- `DATABASE_URL`: URL interna de PostgreSQL con TLS cuando corresponda.
- `APP_BASE_URL`: `https://coro.cintavera.dev` solo después de confirmar el host.
- `BETTER_AUTH_SECRET`: aleatorio de 32 bytes o más.
- `QR_SIGNING_SECRET`: aleatorio e independiente.
- `CRON_SECRET`: aleatorio e independiente.
- `PRIVATE_UPLOAD_DIR=/data/uploads`.
- `APP_TIMEZONE=America/Guayaquil`.
- `AI_VISION_PROVIDER=disabled` hasta aprobar privacidad y proveedor.

La aplicación falla de forma segura si faltan base de datos o secretos. No hay contraseña demo de producción.

## 3. Construcción y migraciones

El contenedor usa Node.js 24.21.0, compila salida standalone y ejecuta `prisma migrate deploy` antes de iniciar `server.js`. El usuario del proceso no es root.

El primer acceso SUPERADMIN se crea desde una consola temporal del mismo entorno:

```bash
SEED_ADMIN_NAME='nombre-aprobado' SEED_ADMIN_EMAIL='correo-aprobado' SEED_ADMIN_PASSWORD='contraseña-larga-temporal' ./node_modules/.bin/tsx prisma/seed.ts
```

Cambiar la contraseña después del alta. El seed nunca lee `private/` y los miembros ficticios están desactivados salvo que `SEED_SYNTHETIC_DATA=true` se configure explícitamente; no habilitarlo en producción.

## 4. Dominio y proxy

Configurar en Coolify `coro.cintavera.dev` con HTTPS y redirección a HTTPS. Verificar primero que `cintavera.dev` sea el dominio aprobado; no sustituirlo por otro dominio parecido. El proxy debe conservar `Host`, `X-Forwarded-Proto` y la IP de origen. No habilitar caché compartida para rutas autenticadas ni adjuntos.

El healthcheck es `GET /api/health`. Solo responde saludable cuando PostgreSQL acepta consultas.

## 5. Tarea programada

Después de configurar día y hora desde la aplicación, programar una llamada diaria:

```bash
curl --fail --request POST 'https://coro.cintavera.dev/api/cron/rehearsals' \
  --header "Authorization: Bearer ${CRON_SECRET}"
```

La tarea es idempotente. Abrir el módulo de asistencia también recupera sesiones faltantes si la tarea no corrió.

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

No se declara una restauración probada hasta ejecutar este procedimiento con un respaldo real autorizado.

## 7. Evidencia del simulacro aislado

El 1 de octubre de 2026 se probó la imagen local del commit `e0065642b3fff6c77ee459a1e3db9dde2358eb23` (`voces-esperanza:e006564`, digest local `sha256:8b108e710da7c8293fa7b7e267e206deffffba9033fdfc3a9cf30ddabe925684`) con PostgreSQL 17 y dos volúmenes exclusivos de prueba.

- Migraciones: 3 aplicadas; health 200.
- Datos sintéticos: 4 miembros, 1 usuario y 1 adjunto.
- Reinicio y recreación de ambos contenedores con los mismos volúmenes: conteos y SHA-256 del adjunto sin cambios.
- Respaldo fuera de contenedores: dump PostgreSQL custom y archivo comprimido del volumen.
- Restauración: PostgreSQL, volumen y aplicación nuevos, sin apuntar al origen.
- Resultado restaurado: health 200; mismos conteos; adjunto con SHA-256 `4222f014…`, propietario `1001:1001`, modo `600`; inicio de sesión sintético y descarga autorizada con `Cache-Control: private, no-store`.

El respaldo del simulacro permanece en el mismo equipo; prueba el procedimiento, no resiliencia ante pérdida completa del servidor. En producción debe copiarse a almacenamiento externo aprobado y probarse periódicamente en recursos separados.
