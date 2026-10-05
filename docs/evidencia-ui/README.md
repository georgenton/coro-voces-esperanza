# Evidencia visual sintética

Todas las capturas de este directorio usan fixtures `example.test` y nombres marcados como sintéticos. No contienen datos, identidades, saldos, pagos ni comprobantes reales del coro.

## Revisión 08

`revision-08/` conserva tres conjuntos comparables, generados con Chromium, las mismas fuentes cargadas, zoom 100 %, tema y viewport explícitos:

- `referencia/`: 18 capturas de la exportación original e inalterada de Claude Design; tres pantallas × tres anchos × dos temas.
- `antes-historico/`: 18 capturas de `source=historical` antes de la corrección.
- `despues/`: 36 capturas de la aplicación corregida; tres pantallas × dos orígenes × tres anchos × dos temas.
- `comparacion-representativa.png`: panel referencia/antes/después para matriz, libro mensual y resumen móvil.

Convención corregida: `<pantalla>-<origen>-<ancho>-<tema>.png`, con `historical|operation`, `390|1024|1440` y `light|dark`.

La prueba `tests/e2e/visual-evidence.spec.ts` recorre siempre las 36 combinaciones en CI. Además de renderizar, comprueba: consola sin errores, ausencia de overlays, `h1` de 22 px, controles de 36/44 px, sidebar de 232 px o cajón móvil, dos columnas KPI a 390 px, cascada de botón secundario, contraste de cabecera histórica oscura, seis columnas semánticas del libro y septiembre visible en la matriz móvil.

Para regenerar las 36 capturas corregidas en una base desechable:

```bash
UPDATE_UI_SCREENSHOTS=true \
VISUAL_OUTPUT_DIR=docs/evidencia-ui/revision-08/despues \
pnpm exec playwright test tests/e2e/visual-evidence.spec.ts --project=chromium-desktop
pnpm verify:visual-evidence
```

Las 18 capturas antiguas en la raíz corresponden a la evidencia operativa de la integración anterior y se mantienen como antecedente. La revisión completa y las diferencias intencionales están en `docs/FIDELIDAD-VISUAL-08.md`.
