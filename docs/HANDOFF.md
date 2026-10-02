# Handoff vigente

Fecha: 1 de octubre de 2026, `America/Guayaquil`.

## Autorización recibida

Jorge autorizó para este proyecto: commits y push, ramas/PR, merge a `main` con controles en verde, GitHub Actions, despliegue en el Coolify existente, recursos exclusivos del coro, cambio DNS mínimo del host confirmado y actualización de Notion/documentación. La autorización no permite borrar datos, force push, desactivar protecciones, cambiar visibilidad, contratar servicios pagos, tocar otros proyectos ni enviar Excel/comprobantes reales a IA no aprobada.

## Estado de Git

- Repositorio: `https://github.com/georgenton/coro-voces-esperanza`.
- Visibilidad comprobada: pública.
- Rama predeterminada corregida a `main`.
- Rama de trabajo: `codex/coro-voces-esperanza`.
- PR 1 integrado con todos los controles verdes; merge `c600b64dc3087a0e448b091da1498aa2889d32c2`.
- La corrección del healthcheck quedó integrada en `main` como merge `a6d048eb313c98f87cf726963b45b0db0922e056`. GitHub creó el merge pero no marcó el PR 2 como fusionado; el PR se cerró después de verificar los dos padres y el árbol en `main`.
- El bootstrap seguro del acceso inicial quedó integrado mediante el PR 4 como merge `786d8aafe2636f890ede2cb56d97ef50b9cd483e`; dos workflows completos pasaron antes del merge.
- `private/`, Excel/CSV, diagnóstico confidencial, entornos, adjuntos, respaldos y artefactos de pruebas/build siguen ignorados por Git y Docker.

## Cambio funcional principal

Se implementó la promoción de staging a datos operativos. El flujo separa cargar, mapear, resolver, aprobar, previsualizar y promover. Cada modificación invalida aprobación; la promoción vuelve a comprobar versión/hash y se ejecuta de forma atómica e idempotente. Las aplicaciones LEGACY no crean caja ni fecha bancaria.

Archivos centrales:

- `prisma/schema.prisma` y migraciones `20261001220000_import_promotion`, `20261001221000_legacy_payment_guard`.
- `src/server/imports/mapping.ts` y `src/server/imports/service.ts`.
- `src/app/(app)/importar/`.
- `docs/CONTRATO-PROMOCION.md` y `docs/MATRIZ-C01-C50.md`.

## Datos reales

No se promovió, aprobó ni publicó ningún saldo, identidad de miembro, fecha o pago real. El Excel y los extractos en `private/` no entraron a Git, CI, Docker, Notion ni servicios externos. Producción inició solo con catálogos: 8 cuerdas, 4 conceptos, 3 cuentas, y cero miembros, usuarios, partes de pago, aplicaciones o movimientos. La identidad del SUPERADMIN inicial fue aprobada fuera del repositorio; la cuenta y su contraseña continúan pendientes de activación privada. La aplicación muestra “Migración histórica pendiente de aprobación”.

## Verificación y operación

- 30 pruebas unitarias, 37 de referencia, 13 de integración PostgreSQL y 6 E2E Docker pasaron localmente. El nuevo caso de integración comprueba un único SUPERADMIN, repetición sin cambiar contraseña/sesión y ausencia de ficha de miembro.
- La imagen del commit funcional es `voces-esperanza:e006564`, digest local `sha256:8b108e710da7c8293fa7b7e267e206deffffba9033fdfc3a9cf30ddabe925684`.
- Persistencia y restauración pasaron con datos y adjunto sintéticos en recursos separados; ver `docs/DEPLOY-COOLIFY.md`.
- Producción: `https://coro.syntavera.dev`, commit `786d8aa`, despliegue Coolify `Success` y health externo 200 con `no-store` y `noindex`.
- Coolify: proyecto `curszcfgrj5qgqoalyjpjfx1`, entorno `hqjrkmlxe1xybokuktovevmb`, app `qwag6glb0gc6jfzlfwa46fi4`, PostgreSQL `cw9lgsmko0t2rnramfsrqmrm`.
- DNS: se usó el registro ya existente de `coro.syntavera.dev`; no se modificó Cloudflare ni se tocó `cintavera.dev`.
- Respaldo `qpat2ip0sang71p3yfh0muwz`: diario a las 03:00, primera ejecución manual exitosa de 101.92 KB. La copia es local al host y no sustituye un respaldo externo.
- Acceso inicial preparado: ejecutar el bootstrap interactivo descrito en `docs/DEPLOY-COOLIFY.md` y detenerse para que el titular introduzca la contraseña oculta. No publicar identidad, contraseña, token ni enlace privado en documentación, GitHub, Notion o chat.
