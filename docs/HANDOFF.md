# Handoff vigente

Fecha: 3 de octubre de 2026, `America/Guayaquil`.

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
- El trabajo de datos e informes se integró mediante el PR 6 como merge `b0a71f3974e6cf8969e6c7e4244e64d645733263` y se desplegó manualmente en Coolify después de respaldo y preflight.
- La integración visual se desarrolla por separado en `codex/interfaz-reportes`; no se ha fusionado ni desplegado y requiere aprobación humana.

## Cambio funcional de la fase de datos integrada

Además del contrato de promoción existente, la rama actual conserva inventario de hojas y evidencia por celda, distingue contenido de ubicación física, compara versiones sin usar el número de fila como identidad y ofrece una vista privada del histórico. También incorpora reporte mensual por cuenta, matriz anual de cuotas y exportaciones CSV construidas sobre las mismas consultas operativas. La fuente histórica nunca se suma directamente a caja, cargos o aplicaciones.

Archivos centrales:

- `prisma/schema.prisma` y migración `20261003113000_historical_source_reports`.
- `src/server/imports/mapping.ts` y `src/server/imports/service.ts`.
- `src/server/imports/workbook.ts`, `comparison.ts` y `source.ts`.
- `src/server/reports/` y `src/app/(app)/reportes/`.
- `src/app/(app)/importar/`, `docs/INFORME-IMPORTACION.md` y `docs/CONTRATO-PROMOCION.md`.

## Datos reales

No se promovió, aprobó ni publicó ningún saldo, identidad de miembro, fecha o pago real. El Excel y los extractos en `private/` no entraron a Git, CI, Docker, Notion ni servicios externos. La copia privada local conserva modo de solo lectura y hash verificado. Producción tiene un SUPERADMIN activo, pero mantiene cero miembros, lotes de importación, cargos, partes, aplicaciones y movimientos. La aplicación continúa mostrando “Migración histórica pendiente de aprobación”.

## Verificación y operación

- 45 pruebas unitarias y 14 de integración PostgreSQL pasaron localmente con Node 24.19.0. La migración nueva se aplicó en PostgreSQL 17; staging sintético comprobó persistencia exacta de hoja/fila/celda e idempotencia; los reportes comprobaron apertura/entradas/salidas/cierre y alcance de jefe de cuerda.
- La fuente real se leyó sin persistirla en la base de pruebas: 30 hojas, 833 filas, 4.357 celdas, 22 meses y octubre parcial. El detalle no nominativo está en `docs/INFORME-IMPORTACION.md`.
- Build productivo, 37 reglas de referencia y 6 E2E pasaron antes del PR 6. Coolify desplegó manualmente el merge, aplicó la cuarta migración y terminó `Success` en 4m01s.
- La imagen del commit funcional es `voces-esperanza:e006564`, digest local `sha256:8b108e710da7c8293fa7b7e267e206deffffba9033fdfc3a9cf30ddabe925684`.
- Persistencia y restauración pasaron con datos y adjunto sintéticos en recursos separados; ver `docs/DEPLOY-COOLIFY.md`.
- Producción: `https://coro.syntavera.dev`, commit `b0a71f3`, despliegue Coolify `Success` y health externo 200 con `{"status":"healthy"}`, `no-store` y `noindex`.
- Coolify: proyecto `curszcfgrj5qgqoalyjpjfx1`, entorno `hqjrkmlxe1xybokuktovevmb`, app `qwag6glb0gc6jfzlfwa46fi4`, PostgreSQL `cw9lgsmko0t2rnramfsrqmrm`.
- DNS: se usó el registro ya existente de `coro.syntavera.dev`; no se modificó Cloudflare ni se tocó `cintavera.dev`.
- Respaldo `qpat2ip0sang71p3yfh0muwz`: diario a las 03:00; el respaldo manual anterior al merge 6 terminó `Success` (102.73 KB). La copia es local al host y no sustituye un respaldo externo.
- El acceso inicial ya está activo. No volver a ejecutar bootstrap salvo recuperación autorizada; no publicar identidad, contraseña, token ni enlace privado en documentación, GitHub, Notion o chat.

## Integración visual pendiente de aprobación

Los artefactos de diseño recibidos el 3 de octubre sí se revisaron y su lenguaje visual se trasladó a componentes Next.js reales. La rama `codex/interfaz-reportes` contiene dashboard, reporte mensual y matriz anual conectados a servicios reales, tema claro/oscuro, panel accesible y E2E autenticado por rol. Los ZIP/HTML de demostración no entraron al runtime.

Esta rama visual debe mantenerse en un PR separado y abierto. No fusionarla ni desplegarla antes de la revisión de Jorge. La configuración de Coolify muestra despliegue por push, pero no se encontró un webhook de GitHub y el merge 6 no inició despliegue automático; se usó redeploy manual. Además, la configuración de build debe revisarse para que secretos runtime no aparezcan como argumentos de construcción; rotar cualquier secreto potencialmente expuesto antes del piloto sin publicar sus valores.
