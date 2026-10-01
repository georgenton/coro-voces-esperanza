# Informe de preparación de importación

Fecha de revisión: 1 de octubre de 2026.

## Evidencia verificada

- El archivo fuente entregado conserva el SHA-256 `6f35538aabc75c2079da62bd221c40d17f792f15f76fd43889b5e3254564a60e`.
- Se confirmaron 30 hojas y la estructura general descrita en el diagnóstico.
- La inspección fue de solo lectura. No se alteró el libro ni se cargaron datos personales a la base de desarrollo.
- `private/` y el diagnóstico detallado permanecen excluidos de Git y de la imagen Docker.

## Implementación del importador

El asistente recibe XLSX en almacenamiento privado, calcula SHA-256, limita tamaño, hojas, filas y celdas, y guarda un lote de staging con hoja, fila, texto original y huella por registro. Una recarga del mismo archivo devuelve el lote existente. Un archivo modificado crea un lote distinto para comparación.

La carga no crea cargos, pagos, movimientos ni saldos. Antes de aprobar, todas las filas e incidencias deben quedar resueltas de forma explícita. Las fechas bancarias desconocidas permanecen nulas y las marcas `X` no se convierten automáticamente en pausas.

## Ambigüedades que siguen requiriendo decisión humana

- identidad y cuerda cuando el nombre o encabezado es ambiguo;
- motivo y vigencia de marcas históricas;
- fecha real de entradas inferidas solo desde una matriz mensual;
- saldos de apertura por cuenta contra evidencia bancaria;
- distribución de depósitos de terceros o pagos familiares;
- tratamiento histórico de parqueadero y actividades cuando la tarifa o el período no están explícitos.

Los totales de referencia del diagnóstico sirven como contraste, no como saldos aprobados ni conciliación bancaria.
