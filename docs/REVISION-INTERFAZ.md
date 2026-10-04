# Revisión e integración de interfaz

Fecha: 4 de octubre de 2026, `America/Guayaquil`.

## Fuente y alcance

La interfaz se integró como componentes React/Next.js sobre la aplicación existente. No se incorporó el runtime de la demostración, ningún `iframe`, Babel en navegador, mocks globales ni una segunda fuente financiera.

Artefactos recibidos y verificados fuera del repositorio:

- demo ZIP: SHA-256 `dcaaadfee72699d9d9034e255a8227063a5c51d0877d2d602e64c1b8cc054ae1`;
- HTML autónomo: SHA-256 `d83f34a6e48456e9c6f77f72855a2b58de27ec597fc6b6d8078ec62995cff341`;
- paquete de revisión: SHA-256 `4a98e44fb2eca099f00a34fcef73532b91ace8189c30b9f5faee869ddd1ed0f7`.

Los ZIP y el HTML no se copiaron a `public/`, Git o la imagen. Solo se trasladaron decisiones visuales: papel cálido, índigo, verde/rojo semánticos, tablas densas, panel lateral, modo oscuro y adaptación móvil. Los iconos usan `lucide-react` con versión fijada; Public Sans y Newsreader se integran mediante `next/font` y quedan autoalojadas en el build, sin solicitudes del navegador a Google Fonts. No se copiaron binarios, imágenes ni runtime de la demostración.

## Pantallas conectadas

1. **Reporte mensual** (`/reportes/movimientos`): alterna de forma explícita entre el libro histórico conservado y `getMonthlyAccountReport`. En operación añade filtros por período, cuenta, tipo y texto, conserva totales del período separados del subtotal filtrado y abre distribuciones/aplicaciones. En histórico conserva hoja, fila, celda, valor y estados de revisión sin convertirlos en caja.
2. **Matriz anual** (`/reportes/cuotas`): alterna entre la matriz literal del staging y `getAnnualDuesReport`. La fuente conserva `X`, vacíos, textos, importes y procedencia; operación aplica concepto, año, corte, cuerda, vigencia, persona y alcance del servidor. En 390 px muestra un mes a la vez mediante navegación explícita.
3. **Dashboard** (`/resumen`): muestra por defecto la fuente histórica a roles financieros cuando existe staging y permite seleccionar operación. La vista operativa usa `getDashboard`; el servidor reaplica el rol al destino y fuerza operación para miembros o jefaturas sin permiso financiero global.

No se inventan cierres ni datos faltantes. `NOT_IMPORTED`, `NOT_DUE`, `FUTURE`, `REVIEW`, crédito y adelanto conservan semánticas separadas.

## Correcciones R01–R04

| ID | Resultado | Evidencia |
|---|---|---|
| R01 | Cerrado | Filas/celdas enfocables abren el panel con `Enter`; Playwright lo ejerce en ambos reportes. |
| R02 | Cerrado | `<dialog>` modal, foco inicial, ciclo de `Tab`, cierre con `Escape` y devolución de foco al disparador; prueba autenticada. |
| R03 | Cerrado | Dashboard → reporte mensual conserva `period`; dashboard/matriz conserva `year`, `cutoff` y `section`; el alcance se recalcula en servidor. |
| R04 | Cerrado | A 390 px no existe ocultamiento global de overflow; cada tabla desplaza solo dentro de su contenedor y Playwright comprueba `scrollWidth`. |

## Temas y evidencia visual

El tema se guarda únicamente como preferencia no sensible en `localStorage` (`vde:theme:v1`) y admite sistema, claro y oscuro. Las 18 capturas reproducibles de dashboard, movimientos y cuotas están en `docs/evidencia-ui/`: 390, 1024 y 1440 px, claro y oscuro, siempre con la base sintética E2E.

Para regenerarlas:

```bash
UPDATE_UI_SCREENSHOTS=true pnpm exec playwright test tests/e2e/visual-evidence.spec.ts --project=chromium-desktop
```

La revisión del 4 de octubre regeneró las 18 capturas después de integrar navegación, tipografías y reportes de doble fuente. Se levantó la rama con Node 24, PostgreSQL local desechable, autenticación y fixtures sintéticos. Pasaron 14 E2E y la prueba visual explícita; el navegador comprobó además 390×844, tema oscuro, cambio de fuente/cuerda/mes, apertura de celda, controles por teclado, exportación, ausencia de desborde y cero errores de consola.

## Entorno local para revisión humana

Mientras el servidor de desarrollo esté activo:

- acceso: `http://127.0.0.1:3000/ingresar`;
- identidad sintética de tesorería: `tesoreria.e2e@example.test`;
- contraseña sintética: la constante `E2E_PASSWORD` de `tests/e2e/global-setup.ts`;
- rutas: `/resumen?period=2026-09`, `/reportes/movimientos?period=2026-09` y `/reportes/cuotas?year=2026&cutoff=2026-09`.

Recorrido breve:

1. En Resumen, cambiar el período de corte y abrir el reporte mensual conservando el mes.
2. En Reporte mensual, elegir `Cuenta E2E`, filtrar por tipo o texto, abrir una fila con `Enter`, cerrar con `Escape` y exportar CSV.
3. En Matriz anual, elegir `Soprano E2E`, buscar `Alba`, aplicar filtros y abrir la celda de septiembre con `Enter`.
4. A 390 px, usar `Siguiente →` y `← Anterior` para cambiar el mes visible; alternar tema hasta oscuro y recorrer controles con teclado.

Este entorno no contiene datos productivos, no desactiva autenticación y no usa credenciales personales de Jorge.

## Aislamiento y aprobación

- Fixtures: correos `example.test`, nombres marcados como sintéticos y base local cuyo nombre contiene `test`/`e2e`.
- El setup E2E se niega a limpiar una base que no sea local, desechable y ejecutada con `NODE_ENV=test`.
- Las pruebas visuales usaron solo fixtures sintéticos. El Excel real se cargó aparte en el staging privado de producción y no se aprobó ni promovió.
- Jorge aprobó expresamente la revisión visual, el merge de la PR 7, el despliegue manual y la publicación de la fuente histórica el 4 de octubre. La autorización no convierte staging en contabilidad aprobada.
- La PR 7 pasó GitHub Actions, se integró como merge `3b8b5c3eecc66a517a4176545c49666c2be71166` y el despliegue manual correspondiente terminó `Success`. Se verificaron en producción el selector de fuente, octubre parcial, procedencia histórica, la matriz literal y la fuente operación sin datos derivados del Excel.

## Brechas operativas fuera de la interfaz

- PostgreSQL y `/data/uploads` ya tienen copia local + R2 y retención de 14 copias/14 días. Falta forzar una recuperación exclusivamente desde R2; la descarga restaurada figuraba disponible en ambos orígenes.
- El bucket R2 y sus credenciales son compartidos por otros recursos de SyntaVera, aunque los objetos están separados por ruta. Un bucket/principal exclusivo del coro requiere una decisión global autorizada.
- Coolify quedó en despliegue manual controlado. La inyección automática de argumentos está deshabilitada; los cuatro secretos afectados se rotaron y una sesión se revocó. Ver `docs/SEGURIDAD-OPERATIVA.md`.
- Los canales salientes globales de notificación están deshabilitados. Los fallos se registran en Coolify, pero no existe un aviso externo comprobado.
