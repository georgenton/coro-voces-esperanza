# Estado de implementación

Fecha de corte: 4 de octubre de 2026.

## Implementado

- Aplicación única Next.js/TypeScript con PostgreSQL, Prisma y autenticación individual por invitación.
- Miembros, cuerdas con vigencia, roles, alcance por cuerda y revocación de sesiones al cambiar permisos.
- Reglas de cuotas idempotentes, excepción fechada de junio de 2026, parqueadero por elegibilidad y cargos de actividades solo para inscritos.
- Movimientos por cuenta, pagos multipartes, aplicaciones a cargos, crédito visible, importe sin identificar, reversos, gastos, transferencias internas, ahorro e intereses.
- Distribución posterior de una entrada conciliada sobre el mismo movimiento, sin registrar caja por segunda vez.
- Dashboard que separa obligaciones, aplicaciones y caja, con métricas financieras solo para roles de tesorería, tendencia de seis meses, pendiente por cuerda, saldos al corte y enlaces que conservan período/alcance.
- Dashboard, reporte mensual y matriz anual con selector explícito entre **fuente histórica** y **operación**. Cuando existe staging, los roles financieros ven por defecto la fuente real conservada; `source=operation` mantiene la contabilidad aprobada. Los roles sin acceso financiero nunca reciben el histórico global.
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
- Reporte mensual por cuenta con apertura calculada, entradas, salidas, cierre, estado de cobertura, filtro de tipo, panel de distribuciones y CSV; matriz anual por concepto con deuda anterior, doce meses, crédito, adelantos, panel de cargos, navegación móvil, CSV y alcance global/por cuerda/individual.
- Interfaz responsive integrada desde los artefactos de diseño recibidos: navegación activa con Lucide, papel cálido, tipografías Public Sans/Newsreader autoalojadas, semántica de estados con texto/icono/color, tema sistema/claro/oscuro y modales accesibles. No usa `iframe`, Babel en navegador ni runtime de demostración.
- Bootstrap privado e interactivo del primer SUPERADMIN: contraseña oculta fuera de argumentos e historial, conservación idempotente de contraseña/sesiones, bloqueo ante otra administración o una identidad conflictiva y ninguna ficha de miembro implícita.
- Workflow de GitHub Actions para lint, tipos, unitarias, reglas de referencia, migraciones PostgreSQL, integración, build, E2E y construcción Docker con fixtures sintéticos.

## Evidencia ejecutada

- `pnpm verify`: lint, tipos, pruebas unitarias y build productivo.
- En la revisión final del 4 de octubre: lint y TypeScript limpios; 49 pruebas unitarias y 14 de integración aprobadas en una base PostgreSQL 17 aislada; esquema Prisma válido y cuatro migraciones sin pendientes.
- La lectura real de solo lectura confirmó SHA-256 `fb50b25e3bb54f9206d150f18a5f1d06b05298df402e518b10a9a596deddd315`, 30 hojas, 833 filas, 4.357 celdas y 22 períodos mensuales entre `2025-01` y `2026-10`.
- La fase visual ejecutó 14 E2E y una prueba visual explícita: filtros, navegación, paneles, foco, `Escape`, CSV, alcance, separación de fuente y desborde. Regeneró 18 capturas sin overlay ni errores de consola en 390/1024/1440 y temas claro/oscuro.
- La imagen local `voces-esperanza:codex-pr7-final` se construyó, arrancó como usuario no root, confirmó 4 migraciones sin pendientes y respondió `{"status":"healthy"}` con `no-store`; el contenedor temporal fue eliminado.
- Pruebas unitarias: reglas financieras, distribución, QR, normalización, lectura XLSX y alcance por objeto.
- `pnpm verify:reference`: 37 pruebas del paquete de referencia y, cuando existe localmente, contraste no nominativo del staging. CI omite de forma explícita ese segundo paso porque `private/` no se versiona.
- `pnpm test:integration`: migración real en PostgreSQL 17 y pruebas de pago idempotente, QR concurrente, transferencia/ahorro/interés/gasto, distribución posterior, reverso, invitación de un uso, revocación de sesión, concurrencia de cargos/pagos, reimportación, promoción LEGACY concurrente sin caja y bootstrap idempotente del SUPERADMIN.
- `pnpm test:e2e`: escritorio y móvil; redirección de pantalla privada, bloqueo de autorregistro, bloqueo de adjuntos anónimos y ausencia de desborde horizontal.
- Construcción de imagen Docker y arranque real: migraciones sin pendientes y `/api/health` saludable.
- Simulacro aislado de persistencia y restauración: reinicio y recreación conservaron PostgreSQL y el adjunto; dump/volumen se restauraron en recursos nuevos con los mismos conteos, hash, propietario/modo y descarga autenticada sin caché compartida.
- GitHub Actions pasó dos veces sobre el cambio funcional y dos veces sobre la corrección del healthcheck: lint, tipos, unitarias, referencia, migraciones, integración, build, E2E y construcción Docker.
- Producción en `https://coro.syntavera.dev`: antes del despliegue de esta entrega conservaba rama `main`, commit funcional `b0a71f3`, health externo 200 e interno `healthy`. Jorge aprobó la PR 7 y su publicación; el resultado definitivo del merge y despliegue se registra en `docs/HANDOFF.md` y `docs/DEPLOY-COOLIFY.md`.
- Los cuatro secretos que aparecieron como argumentos de un build anterior se excluyeron del build, se rotaron y se comprobaron como runtime-only. Una sesión del coro se revocó; no se cambiaron usuarios ni contraseñas personales. Ver `docs/SEGURIDAD-OPERATIVA.md`.
- El respaldo real posterior a la rotación terminó `Success` con disponibilidad local + S3 y se restauró con PostgreSQL 17 en un recurso temporal sin red. La copia independiente forzada desde R2 sigue pendiente porque Coolify no expone cuál origen usa su descarga cuando ambos están disponibles.
- La restauración confirmó 42 tablas, 1 usuario y cero sesiones, miembros, filas importadas, cargos, partes, aplicaciones, movimientos y adjuntos. No se promovió el Excel.

## Pendiente de evidencia o decisión humana

- El Excel real se cargó en **staging privado de producción** el 4 de octubre, después de respaldos. El lote conserva el hash verificado, 30 hojas, 833 filas, 4.357 celdas y 21 incidencias. Una segunda carga devolvió el mismo lote, sin duplicarlo.
- La carga no aprobó ni promovió identidades, fechas, saldos, marcas, cargos, pagos o movimientos. La transformación operativa existe, pero cada ambigüedad sigue requiriendo revisión humana; revertir una importación ya usada por operaciones posteriores requerirá ajustes/reversos auditados, no borrado.
- No se probaron comprobantes bancarios reales ni el proveedor de visión; sin clave, el flujo manual permanece funcional.
- El SUPERADMIN inicial ya está activo y se mantiene fuera del repositorio. No se expusieron identidad, contraseña, sesión ni secretos durante esta revisión.
- La interfaz de Claude está integrada en `codex/interfaz-reportes`; Jorge otorgó aprobación visual y de publicación el 4 de octubre. Ver `docs/REVISION-INTERFAZ.md` para el alcance y `docs/HANDOFF.md` para el estado operativo final.
- PostgreSQL y `/data/uploads` ya tienen copia externa en R2. Falta probar una descarga forzada desde R2 sin copia local y, cuando existan adjuntos reales, repetir su restauración; el volumen actual está vacío.
- La matriz C01–C50 está documentada. Persisten coberturas parciales que requieren E2E autenticado por rol, comprobantes reales aprobados y validación operativa; ver `docs/MATRIZ-C01-C50.md`.
- El estado de despliegue, URL, commit e imagen se registra en `docs/DEPLOY-COOLIFY.md`; la migración histórica real continúa bloqueada hasta aprobación humana.

No se afirma conciliación bancaria, saldos aprobados, recuperación total ante pérdida del host ni aceptación operativa completa.
