# Informe de preparación de importación

Fecha de revisión: 4 de octubre de 2026.

## Evidencia verificada

- El archivo `REPORTE 7. CUOTAS.xlsx` conserva el SHA-256 `fb50b25e3bb54f9206d150f18a5f1d06b05298df402e518b10a9a596deddd315` declarado en la guía del 1 de octubre.
- Se confirmaron 30 hojas, 833 filas no vacías conservadas y 4.357 celdas con evidencia. Las 22 hojas mensuales cubren `2025-01` a `2026-10`; octubre de 2026 es parcial al corte inclusivo `2026-10-01`, `America/Guayaquil`.
- La inspección local del archivo fue de solo lectura. El 4 de octubre, después de respaldos productivos, la copia de hash verificado se cargó mediante la sesión autenticada en el staging privado de `coro.syntavera.dev`.
- Producción confirmó un único lote con 30 hojas, 833 filas, 4.357 celdas y 21 incidencias. Una segunda carga del mismo archivo devolvió el mismo identificador y el mensaje de que no se duplicó.
- `private/` y el diagnóstico detallado permanecen excluidos de Git y de la imagen Docker.

## Implementación del importador

El asistente recibe XLSX en almacenamiento privado, calcula SHA-256, limita tamaño, hojas, filas y celdas, y guarda un lote de staging con inventario físico de hojas, fila, celda, valor literal, fórmula, valor cacheado, nota, fecha original, formato, evidencia de estilo, versión de mapeo y huellas separadas de contenido y procedencia. Una recarga del mismo archivo devuelve el lote existente. Un archivo modificado crea un lote distinto para comparación.

La comparación entre versiones clasifica filas como nuevas, coincidentes, modificadas, ambiguas, ausentes o ya publicadas. La fila física no se usa como identidad permanente. La vista **Histórico fuente** mantiene este staging privado separado de miembros, cargos, aplicaciones y movimientos.

La carga realizada no creó cargos, pagos, movimientos, miembros ni saldos; el lote permanece en revisión, con mapeo v0 y sin aprobación vigente. Antes de aprobar, todas las filas e incidencias deben quedar resueltas de forma explícita. Las fechas bancarias desconocidas permanecen nulas y las marcas `X` no se convierten automáticamente en pausas.

## Incidencias no nominativas detectadas

- 4 fechas de filas candidatas a movimiento están fuera del mes nominal.
- 1 fecha de apertura no corresponde al mes inmediatamente anterior.
- octubre de 2026 conserva una fecha de 2025 y está marcado como parcial;
- 2 rótulos conservan referencias antiguas;
- la matriz 2026 contiene contador no equivalente al padrón, una fila sin número, una fila administrativa, un importe atípico `55`, una fórmula anual que requiere revisión y valores de junio que contradicen la hipótesis previa;
- 2 menciones mensuales quedan como identidades candidatas, nunca como altas automáticas;
- ahorro y parqueadero contienen bloques de más de un año;
- toda fecha bancaria derivada solamente de una celda periódica permanece pendiente.

Las fechas de la fila de apertura que sí corresponden al cierre del mes anterior se clasifican como contexto de apertura y no como movimientos fuera de período. Sus celdas originales permanecen intactas.

## Ambigüedades que siguen requiriendo decisión humana

- identidad y cuerda cuando el nombre o encabezado es ambiguo;
- motivo y vigencia de marcas históricas;
- fecha real de entradas inferidas solo desde una matriz mensual;
- saldos de apertura por cuenta contra evidencia bancaria;
- distribución de depósitos de terceros o pagos familiares;
- tratamiento histórico de parqueadero y actividades cuando la tarifa o el período no están explícitos.

Los totales de referencia del diagnóstico sirven como contraste, no como saldos aprobados ni conciliación bancaria.

## Estado de publicación

Los reportes principales pueden mostrar esta evidencia como **fuente histórica** con procedencia y advertencias. Esa visualización no duplica caja ni transforma staging en registros operativos. La fuente **operación** continúa separada y solo podrá cambiar mediante mapeo, aprobación y promoción auditados.
