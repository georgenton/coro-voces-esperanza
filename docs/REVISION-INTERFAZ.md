# Revisión e integración de interfaz

Fecha: 3 de octubre de 2026, `America/Guayaquil`.

## Fuente y alcance

La interfaz se integró como componentes React/Next.js sobre la aplicación existente. No se incorporó el runtime de la demostración, ningún `iframe`, Babel en navegador, mocks globales ni una segunda fuente financiera.

Artefactos recibidos y verificados fuera del repositorio:

- demo ZIP: SHA-256 `dcaaadfee72699d9d9034e255a8227063a5c51d0877d2d602e64c1b8cc054ae1`;
- HTML autónomo: SHA-256 `d83f34a6e48456e9c6f77f72855a2b58de27ec597fc6b6d8078ec62995cff341`;
- paquete de revisión: SHA-256 `4a98e44fb2eca099f00a34fcef73532b91ace8189c30b9f5faee869ddd1ed0f7`.

Los ZIP y el HTML no se copiaron a `public/`, Git o la imagen. Solo se trasladaron decisiones visuales: papel cálido, índigo, verde/rojo semánticos, tablas densas, panel lateral, modo oscuro y adaptación móvil. No se añadieron binarios de tipografías, iconos o imágenes de terceros; la aplicación usa glifos de texto y fallbacks del sistema, por lo que esta rama no introduce una nueva obligación de licencia.

## Pantallas conectadas

1. **Reporte mensual** (`/reportes/movimientos`): usa `getMonthlyAccountReport`, añade filtros por período, cuenta, tipo y texto, conserva totales del período separados del subtotal filtrado, exporta con la misma consulta y abre el movimiento con sus distribuciones y aplicaciones reales.
2. **Matriz anual** (`/reportes/cuotas`): usa `getAnnualDuesReport`, añade concepto, año, corte, cuerda, vigencia y persona, aplica el alcance del servidor a tesorería, dirección, jefatura y miembro, y abre el detalle de los cargos que forman cada celda. En 390 px muestra un mes a la vez mediante navegación explícita.
3. **Dashboard** (`/resumen`): usa `getDashboard`, presenta obligaciones, flujo mensual, tendencia de seis meses, pendiente por cuerda y saldos por cuenta. Los enlaces preservan período y cuerda cuando corresponde; el servidor reaplica el rol al destino.

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

## Aislamiento y aprobación

- Fixtures: correos `example.test`, nombres marcados como sintéticos y base local cuyo nombre contiene `test`/`e2e`.
- El setup E2E se niega a limpiar una base que no sea local, desechable y ejecutada con `NODE_ENV=test`.
- No se usó ni promovió el Excel real.
- La interfaz se entrega en `codex/interfaz-reportes` y su PR debe permanecer abierto para revisión humana. No debe desplegarse ni fusionarse a `main` antes de aprobación visual.

## Brechas operativas fuera de la interfaz

- El respaldo productivo sigue en el mismo host; falta copia externa.
- La configuración indica despliegue por push, pero no existe un webhook de GitHub verificable; el despliegue de la PR 6 tuvo que iniciarse manualmente.
- La salida de construcción de Coolify puede exponer variables como argumentos de build. Se deben retirar secretos runtime del alcance de build y rotar los secretos potencialmente expuestos antes del piloto. Este documento no incluye sus valores.
