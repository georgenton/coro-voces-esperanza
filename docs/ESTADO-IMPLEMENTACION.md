# Estado de implementación

Fecha de corte: 4 de octubre de 2026.

## Implementado

- Aplicación única Next.js/TypeScript con PostgreSQL, Prisma y autenticación individual por invitación.
- Miembros, cuerdas con vigencia, roles, alcance por cuerda y revocación de sesiones al cambiar permisos.
- Reglas de cuotas idempotentes, excepción fechada de junio de 2026, parqueadero por elegibilidad y cargos de actividades solo para inscritos.
- Movimientos por cuenta, pagos multipartes, aplicaciones a cargos, crédito visible, importe sin identificar, reversos, gastos, transferencias internas, ahorro e intereses.
- Distribución posterior de una entrada conciliada sobre el mismo movimiento, sin registrar caja por segunda vez.
- Dashboard que separa obligaciones, aplicaciones y caja, con métricas financieras solo para roles de tesorería.
- Importación XLSX a staging privado con hash, vista previa, filas, incidencias y bloqueo de aprobación mientras existan pendientes.
- Conservación de las 30 hojas y de evidencia por celda (valor, fórmula, caché, nota, fecha y formato), separación de huella de contenido/procedencia y comparación conservadora entre versiones.
- Vista privada **Histórico fuente**, sin mezcla con operación, con cobertura, incidencias, filtros, fórmulas y estados nuevo/coincidente/modificado/ambiguo/ausente/ya publicado.
- Mapeo explícito por fila para identidad, miembro, cuerda/vigencia, cargo, aplicación LEGACY, movimiento confirmado y saldo de apertura. Cada edición invalida aprobación y vistas previas.
- Promoción de staging a registros operativos por alcance explícito, con vista previa de altas, enlaces, cargos, aplicaciones, movimientos, aperturas, duplicados y diferencias; transacción serializable, reintentos idempotentes y trazabilidad a archivo/hoja/fila/hash/aprobador.
- Aplicaciones históricas sin movimiento verificable usan partes LEGACY sin efecto de caja ni fecha de recepción inventada.
- Conciliación por lotes con imágenes/CSV, detección de evidencia repetida, corrección manual y adaptador opcional de visión que nunca confirma por sí solo.
- Incidencias con simulación y aprobación; solo ajustan saldo pendiente y conservan pagos e historial.
- Actividades, participantes, cargos explícitos y gastos enlazados.
- Ensayos, convocatorias, QR firmado y temporal, identidad autenticada, ventana de registro, cierre con ausencias y corrección manual auditada.
- Archivos privados fuera de `public/`, descargas autorizadas, CSV de cuotas neutralizado contra fórmulas y cabeceras sin caché compartida.
- Docker multi-stage no root, migraciones al arranque, healthcheck, Compose y guía para Coolify.
- Reporte mensual por cuenta con apertura calculada, entradas, salidas, cierre, estado de cobertura y CSV; matriz anual de cuotas con deuda anterior, doce meses, crédito, adelantos, filtros, CSV y alcance por rol/cuerda.
- Bootstrap privado e interactivo del primer SUPERADMIN: contraseña oculta fuera de argumentos e historial, conservación idempotente de contraseña/sesiones, bloqueo ante otra administración o una identidad conflictiva y ninguna ficha de miembro implícita.
- Workflow de GitHub Actions para lint, tipos, unitarias, reglas de referencia, migraciones PostgreSQL, integración, build, E2E y construcción Docker con fixtures sintéticos.

## Evidencia ejecutada

- `pnpm verify`: lint, tipos, pruebas unitarias y build productivo.
- En la revisión del 3 de octubre: lint y TypeScript limpios; 45 pruebas unitarias y 14 de integración aprobadas; esquema Prisma válido; la cuarta migración se aplicó correctamente en PostgreSQL 17 local.
- La lectura real de solo lectura confirmó SHA-256 `fb50b25e3bb54f9206d150f18a5f1d06b05298df402e518b10a9a596deddd315`, 30 hojas, 833 filas, 4.357 celdas y 22 períodos mensuales entre `2025-01` y `2026-10`.
- Build productivo y 6 E2E Playwright pasaron; la revisión visual confirmó contenido, ausencia de overlay/errores y cero desborde horizontal a 390×844.
- La imagen local `voces-esperanza:codex-historical-reports` se construyó, arrancó como usuario no root, confirmó 4 migraciones sin pendientes y respondió `{"status":"healthy"}`; el contenedor temporal fue eliminado.
- Pruebas unitarias: reglas financieras, distribución, QR, normalización, lectura XLSX y alcance por objeto.
- `pnpm verify:reference`: 37 pruebas del paquete de referencia y, cuando existe localmente, contraste no nominativo del staging. CI omite de forma explícita ese segundo paso porque `private/` no se versiona.
- `pnpm test:integration`: migración real en PostgreSQL 17 y pruebas de pago idempotente, QR concurrente, transferencia/ahorro/interés/gasto, distribución posterior, reverso, invitación de un uso, revocación de sesión, concurrencia de cargos/pagos, reimportación, promoción LEGACY concurrente sin caja y bootstrap idempotente del SUPERADMIN.
- `pnpm test:e2e`: escritorio y móvil; redirección de pantalla privada, bloqueo de autorregistro, bloqueo de adjuntos anónimos y ausencia de desborde horizontal.
- Construcción de imagen Docker y arranque real: migraciones sin pendientes y `/api/health` saludable.
- Simulacro aislado de persistencia y restauración: reinicio y recreación conservaron PostgreSQL y el adjunto; dump/volumen se restauraron en recursos nuevos con los mismos conteos, hash, propietario/modo y descarga autenticada sin caché compartida.
- GitHub Actions pasó dos veces sobre el cambio funcional y dos veces sobre la corrección del healthcheck: lint, tipos, unitarias, referencia, migraciones, integración, build, E2E y construcción Docker.
- Producción en `https://coro.syntavera.dev`: rama `main`, commit funcional `b0a71f3`; la PR 7 continúa abierta, sin fusionar ni desplegar.
- Los cuatro secretos que aparecieron como argumentos de un build anterior se excluyeron del build, se rotaron y se comprobaron como runtime-only. Una sesión del coro se revocó; no se cambiaron usuarios ni contraseñas personales. Ver `docs/SEGURIDAD-OPERATIVA.md`.
- El respaldo real posterior a la rotación terminó `Success` con disponibilidad local + S3 y se restauró con PostgreSQL 17 en un recurso temporal sin red. La copia independiente forzada desde R2 sigue pendiente porque Coolify no expone cuál origen usa su descarga cuando ambos están disponibles.
- La restauración confirmó 42 tablas, 1 usuario y cero sesiones, miembros, filas importadas, cargos, partes, aplicaciones, movimientos y adjuntos. No se promovió el Excel.

## Pendiente de evidencia o decisión humana

- El Excel real no se publicó en la base operativa. Solo se inspeccionó en modo lectura; identidades, fechas, saldos de apertura, marcas y aplicaciones requieren revisión y aprobación humana.
- La transformación definitiva ya está implementada, pero ningún dato real fue aprobado ni promovido. Revertir una importación ya usada por operaciones posteriores sigue requiriendo ajustes/reversos auditados, no borrado.
- No se probaron comprobantes bancarios reales ni el proveedor de visión; sin clave, el flujo manual permanece funcional.
- El SUPERADMIN inicial ya está activo y se mantiene fuera del repositorio. No se expusieron identidad, contraseña, sesión ni secretos durante esta revisión.
- La interfaz de Claude ya está integrada en la PR 7 y conserva su revisión visual pendiente. No está fusionada ni desplegada.
- PostgreSQL y `/data/uploads` ya tienen copia externa en R2. Falta probar una descarga forzada desde R2 sin copia local y, cuando existan adjuntos reales, repetir su restauración; el volumen actual está vacío.
- La matriz C01–C50 está documentada. Persisten coberturas parciales que requieren E2E autenticado por rol, comprobantes reales aprobados y validación operativa; ver `docs/MATRIZ-C01-C50.md`.
- El estado de despliegue, URL, commit e imagen se registra en `docs/DEPLOY-COOLIFY.md`; la migración histórica real continúa bloqueada hasta aprobación humana.

No se afirma conciliación bancaria, saldos aprobados, recuperación total ante pérdida del host ni aceptación operativa completa.
