# Handoff vigente

Fecha: 1 de octubre de 2026, `America/Guayaquil`.

## Autorización recibida

Jorge autorizó para este proyecto: commits y push, ramas/PR, merge a `main` con controles en verde, GitHub Actions, despliegue en el Coolify existente, recursos exclusivos del coro, cambio DNS mínimo del host confirmado y actualización de Notion/documentación. La autorización no permite borrar datos, force push, desactivar protecciones, cambiar visibilidad, contratar servicios pagos, tocar otros proyectos ni enviar Excel/comprobantes reales a IA no aprobada.

## Estado de Git

- Repositorio: `https://github.com/georgenton/coro-voces-esperanza`.
- Visibilidad comprobada: pública.
- Rama de trabajo: `codex/coro-voces-esperanza`.
- El repositorio remoto estaba vacío. El checkpoint revisado `6b2bec3` inicializó la rama de trabajo y `main` con el mismo árbol, después de comprobar exclusiones de privacidad.
- `private/`, Excel/CSV, diagnóstico confidencial, entornos, adjuntos, respaldos y artefactos de pruebas/build siguen ignorados por Git y Docker.

## Cambio funcional principal

Se implementó la promoción de staging a datos operativos. El flujo separa cargar, mapear, resolver, aprobar, previsualizar y promover. Cada modificación invalida aprobación; la promoción vuelve a comprobar versión/hash y se ejecuta de forma atómica e idempotente. Las aplicaciones LEGACY no crean caja ni fecha bancaria.

Archivos centrales:

- `prisma/schema.prisma` y migraciones `20261001220000_import_promotion`, `20261001221000_legacy_payment_guard`.
- `src/server/imports/mapping.ts` y `src/server/imports/service.ts`.
- `src/app/(app)/importar/`.
- `docs/CONTRATO-PROMOCION.md` y `docs/MATRIZ-C01-C50.md`.

## Datos reales

No se promovió, aprobó ni publicó ningún saldo, identidad, fecha o pago real. El Excel y los extractos en `private/` no entraron a Git, CI, Docker, Notion ni servicios externos. Producción debe iniciar solo con catálogos y un SUPERADMIN aprobado; la aplicación muestra “Migración histórica pendiente de aprobación”.

## Verificación y operación

- 25 pruebas unitarias, 37 de referencia, 11 de integración PostgreSQL y 6 E2E Docker pasaron localmente.
- La imagen del commit funcional es `voces-esperanza:e006564`, digest local `sha256:8b108e710da7c8293fa7b7e267e206deffffba9033fdfc3a9cf30ddabe925684`.
- Persistencia y restauración pasaron con datos y adjunto sintéticos en recursos separados; ver `docs/DEPLOY-COOLIFY.md`.
- La URL, commit final, PR/CI y recursos Coolify se completan al cierre de esta misma sesión. Hasta entonces, este documento no acredita publicación externa.
