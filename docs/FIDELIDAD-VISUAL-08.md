# Fidelidad visual 08

Fecha: 4 de octubre de 2026, `America/Guayaquil`.

## Alcance y fuentes

Esta corrección modifica presentación, navegación y pruebas visuales. No modifica esquema, migraciones, importación, promoción, permisos, identidades, incidencias, saldos ni reglas financieras. La base usada para comprobarla es PostgreSQL local y desechable; el lote, usuarios y movimientos son sintéticos.

La referencia es la exportación original de Claude Design verificada por SHA-256 `dcaaadfee72699d9d9034e255a8227063a5c51d0877d2d602e64c1b8cc054ae1`. El paquete de corrección se extrajo fuera del repositorio y no sobrescribió la aplicación. No se incorporó el runtime, `data.js`, Babel ni datos de demostración al producto.

## V01–V12

| ID | Reproducción | Corrección | Verificación |
|---|---|---|---|
| V01 | La evidencia anterior cubría 18 casos de operación y no probaba histórico. | La matriz visual recorre tres pantallas, dos orígenes, tres anchos y dos temas. | 36 casos en `visual-evidence.spec.ts` y `revision-08/despues/`; inventario validado por `pnpm verify:visual-evidence`. |
| V02 | La matriz histórica repetía hoja/fila y una frase de estado en cada celda. | Procedencia y lectura extensa pasan al panel; las celdas usan valor, icono accesible y leyenda compartida. La agrupación usa la cuerda literal o declara que no está indicada. | Panel con procedencia por teclado/clic; CSV conserva `AMOUNT` y nunca introduce `PAID`. |
| V03 | Nombre 208 px, mes 110,4 px y filas altas; la matriz ocupaba 112 rem. | Nombre 220 px, meses 82 px y fila compacta de 40 px, según la referencia. | Mediciones CSS y 18 capturas históricas antes/después. |
| V04 | `.button, button.button` ganaba a `.button-secondary` en botones reales. | La variante secundaria tiene especificidad explícita para enlace y botón. | Los 36 casos comprueban que el fondo no toma el índigo primario. |
| V05 | Fecha y observación usaban `#6e5410` también en tema oscuro. | Token `--date-ink`: `#6e5410` claro y `#e9d18a` oscuro; avisos usan mezcla semántica del tema. | Playwright exige `rgb(233, 209, 138)` en el libro histórico oscuro. |
| V06 | Trece enlaces tenían la misma jerarquía. | Tres reportes primarios y grupos Gestión, Auditoría y Sistema; se conservan rutas y filtros por rol. | Escritorio, móvil y pruebas de alcance existentes. |
| V07 | A 390 px aparecía una tira horizontal de navegación y los KPI caían a una columna. | Cajón modal a 820 px, `Escape`, retorno de foco y KPI en dos columnas. | E2E móvil y medición de columnas en la matriz de 36 casos. |
| V08 | El período era un campo aislado sin mes anterior/siguiente. | Selector compacto con flechas, mes y estado parcial, conservando origen y filtros. | Dashboard y ambos libros, claro/oscuro y tres anchos. |
| V09 | El libro histórico añadía una séptima columna técnica Origen y no tenía pie ni expansión. | Seis columnas, observaciones expandibles, pie de importes documentados y procedencia en panel. | E2E niega la cabecera Origen, expande observación y abre procedencia. |
| V10 | La matriz móvil comenzaba siempre en enero. | Inicia en `month` o en el mes de corte; anterior/siguiente actualizan el contexto visible. | Septiembre es visible al abrir `month=9` a 390 px en ambos orígenes. |
| V11 | Aviso global, aviso de página y tarjetas técnicas repetían la misma cautela. | Se elimina el aviso global; queda una advertencia contextual y los detalles técnicos son desplegables. | Capturas del resumen y de la matriz histórica. |
| V12 | Título hasta 28 px, controles 41,6–43,2 px y panel de 480 px. | Título 22 px, control 36 px, objetivo táctil 44 px y panel 420 px. | Contrato visual automatizado en los 36 casos. |

## Mediciones comparables

No se publica un porcentaje de similitud. Se contrastan dimensiones y comportamientos observables:

| Propiedad | Referencia | Antes | Después |
|---|---:|---:|---:|
| Sidebar escritorio | 232 px | 232 px | 232 px |
| Cabecera | 60 px | 60 px | 60 px |
| Título principal | 22 px | hasta 28 px | 22 px |
| Texto de tabla | 13 px | 14,08 px | 13 px |
| Control escritorio | 36 px | 41,6–43,2 px | 36 px |
| Objetivo móvil | 44 px | sin contrato uniforme | 44 px |
| Panel lateral | 420 px | 480 px | 420 px |
| Columna de mes | 82 px | 110,4 px | 82 px |
| Nombre en matriz | 220 px | 208 px | 220 px |
| Ancho mínimo del libro | 860 px | 992 px | 860 px |
| Cambio a navegación móvil | 820 px | 960 px con tira horizontal | 820 px con cajón |
| KPI a 390 px | 2 columnas | 1 columna | 2 columnas |
| Tinta fecha en oscuro | `#e9d18a` | `#6e5410` | `#e9d18a` |

El panel comparativo está en [`comparacion-representativa.png`](evidencia-ui/revision-08/comparacion-representativa.png). Las imágenes fuente completas permanecen junto a él para revisar contenido fuera del recorte.

## Diferencias intencionales frente a la demostración

- La fuente histórica dice “importe documentado” o “revisar”; no muestra “pagado”, “vencido”, saldos finales ni estados operativos que la fuente no demuestra.
- Se conserva el selector Histórico/Operación porque son fuentes y reglas distintas. La demostración no tenía ese requisito productivo.
- No se copiaron insignia de demostración, selector de rol simulado, acciones ficticias de registro, cifras ni identidades del demo.
- La navegación mantiene módulos reales, acceso individual y salida de sesión. El cajón aplica permisos calculados por el servidor.
- La referencia y la aplicación usan fixtures sintéticos equivalentes, no las mismas cifras; las comparaciones son de sistema visual, geometría, semántica y comportamiento.
- La matriz conserva desplazamiento dentro de su contenedor para no ocultar meses ni inventar una reducción de datos.

## Pruebas de significado y seguridad

- El CSV histórico mensual contiene el detalle y el importe de la fixture, pero no el pago operativo sintético.
- El CSV histórico de cuotas conserva `AMOUNT` y no contiene `PAID`.
- Los DTO y exportadores siguen usando las mismas consultas; esta fase no cambió código de servidor de reportes.
- El setup E2E crea staging histórico solo si la URL es local, el nombre de base contiene `test`/`e2e` y `NODE_ENV=test`.
- Ningún XLSX, archivo de `private/` ni dato real forma parte de Git, CI o capturas.
