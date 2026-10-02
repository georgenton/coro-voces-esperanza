# Estado de implementación

Fecha de corte: 1 de octubre de 2026.

## Implementado

- Aplicación única Next.js/TypeScript con PostgreSQL, Prisma y autenticación individual por invitación.
- Miembros, cuerdas con vigencia, roles, alcance por cuerda y revocación de sesiones al cambiar permisos.
- Reglas de cuotas idempotentes, excepción fechada de junio de 2026, parqueadero por elegibilidad y cargos de actividades solo para inscritos.
- Movimientos por cuenta, pagos multipartes, aplicaciones a cargos, crédito visible, importe sin identificar, reversos, gastos, transferencias internas, ahorro e intereses.
- Distribución posterior de una entrada conciliada sobre el mismo movimiento, sin registrar caja por segunda vez.
- Dashboard que separa obligaciones, aplicaciones y caja, con métricas financieras solo para roles de tesorería.
- Importación XLSX a staging privado con hash, vista previa, filas, incidencias y bloqueo de aprobación mientras existan pendientes.
- Mapeo explícito por fila para identidad, miembro, cuerda/vigencia, cargo, aplicación LEGACY, movimiento confirmado y saldo de apertura. Cada edición invalida aprobación y vistas previas.
- Promoción de staging a registros operativos por alcance explícito, con vista previa de altas, enlaces, cargos, aplicaciones, movimientos, aperturas, duplicados y diferencias; transacción serializable, reintentos idempotentes y trazabilidad a archivo/hoja/fila/hash/aprobador.
- Aplicaciones históricas sin movimiento verificable usan partes LEGACY sin efecto de caja ni fecha de recepción inventada.
- Conciliación por lotes con imágenes/CSV, detección de evidencia repetida, corrección manual y adaptador opcional de visión que nunca confirma por sí solo.
- Incidencias con simulación y aprobación; solo ajustan saldo pendiente y conservan pagos e historial.
- Actividades, participantes, cargos explícitos y gastos enlazados.
- Ensayos, convocatorias, QR firmado y temporal, identidad autenticada, ventana de registro, cierre con ausencias y corrección manual auditada.
- Archivos privados fuera de `public/`, descargas autorizadas, CSV de cuotas neutralizado contra fórmulas y cabeceras sin caché compartida.
- Docker multi-stage no root, migraciones al arranque, healthcheck, Compose y guía para Coolify.
- Bootstrap privado e interactivo del primer SUPERADMIN: contraseña oculta fuera de argumentos e historial, conservación idempotente de contraseña/sesiones, bloqueo ante otra administración o una identidad conflictiva y ninguna ficha de miembro implícita.
- Workflow de GitHub Actions para lint, tipos, unitarias, reglas de referencia, migraciones PostgreSQL, integración, build, E2E y construcción Docker con fixtures sintéticos.

## Evidencia ejecutada

- `pnpm verify`: lint, tipos, pruebas unitarias y build productivo.
- Pruebas unitarias: reglas financieras, distribución, QR, normalización, lectura XLSX y alcance por objeto.
- `pnpm verify:reference`: 37 pruebas del paquete de referencia y, cuando existe localmente, contraste no nominativo del staging. CI omite de forma explícita ese segundo paso porque `private/` no se versiona.
- `pnpm test:integration`: migración real en PostgreSQL 17 y pruebas de pago idempotente, QR concurrente, transferencia/ahorro/interés/gasto, distribución posterior, reverso, invitación de un uso, revocación de sesión, concurrencia de cargos/pagos, reimportación, promoción LEGACY concurrente sin caja y bootstrap idempotente del SUPERADMIN.
- `pnpm test:e2e`: escritorio y móvil; redirección de pantalla privada, bloqueo de autorregistro, bloqueo de adjuntos anónimos y ausencia de desborde horizontal.
- Construcción de imagen Docker y arranque real: migraciones sin pendientes y `/api/health` saludable.
- Simulacro aislado de persistencia y restauración: reinicio y recreación conservaron PostgreSQL y el adjunto; dump/volumen se restauraron en recursos nuevos con los mismos conteos, hash, propietario/modo y descarga autenticada sin caché compartida.
- GitHub Actions pasó dos veces sobre el cambio funcional y dos veces sobre la corrección del healthcheck: lint, tipos, unitarias, referencia, migraciones, integración, build, E2E y construcción Docker.
- Producción en `https://coro.syntavera.dev`: HTTPS y página de acceso 200, health externo 200, health interno de Coolify `healthy`, PostgreSQL privado y volumen persistente.
- Producción inició sin datos inventados: 0 miembros, usuarios, partes de pago, aplicaciones y movimientos; solo 8 cuerdas, 4 conceptos y 3 cuentas de catálogo.
- Respaldo PostgreSQL programado diariamente y primera ejecución manual exitosa; la retención es local al host.

## Pendiente de evidencia o decisión humana

- El Excel real no se publicó en la base operativa. Solo se inspeccionó en modo lectura; identidades, fechas, saldos de apertura, marcas y aplicaciones requieren revisión y aprobación humana.
- La transformación definitiva ya está implementada, pero ningún dato real fue aprobado ni promovido. Revertir una importación ya usada por operaciones posteriores sigue requiriendo ajustes/reversos auditados, no borrado.
- No se probaron comprobantes bancarios reales ni el proveedor de visión; sin clave, el flujo manual permanece funcional.
- La identidad del SUPERADMIN inicial ya fue aprobada y se mantiene fuera del repositorio. La cuenta sigue pendiente de que su titular defina la contraseña directamente en la consola privada; no existe contraseña provisional.
- Falta configurar almacenamiento externo para copias y ejecutar un simulacro de restauración usando un respaldo real de producción en un host separado.
- La matriz C01–C50 está documentada. Persisten coberturas parciales que requieren E2E autenticado por rol, comprobantes reales aprobados y validación operativa; ver `docs/MATRIZ-C01-C50.md`.
- El estado de despliegue, URL, commit e imagen se registra en `docs/DEPLOY-COOLIFY.md`; la migración histórica real continúa bloqueada hasta aprobación humana.

No se afirma conciliación bancaria, saldos aprobados, respaldo externo probado ni aceptación operativa completa.
