# Contrato de promoción de staging

Este documento describe el paso controlado entre un Excel privado en staging y los registros operativos. No aprueba el Excel real ni sus saldos.

## Estados y aprobaciones

- `ImportBatch.sha256` identifica el archivo inmutable. Una copia exacta devuelve el lote existente.
- Cada `ImportSheet` conserva orden físico, tipo, período nominal, cobertura, rango y bloques de año. Cada `ImportCell` conserva referencia, valor literal, fórmula, caché, nota, fecha, formato y evidencia de estilo. Cada `ImportRow` conserva procedencia física, huella de contenido independiente de la fila, clave semántica conservadora y clasificación de contexto/candidato/agregado.
- Su transformación tiene tipo, JSON validado, hash, estado, revisor y fecha.
- Editar o resolver una fila/incidencia incrementa `mappingVersion`, borra `mappingHash`, devuelve el lote a revisión e invalida planes no ejecutados.
- Aprobar el lote exige cero pendientes y vuelve a validar todas las transformaciones. Fija versión, hash, aprobador y fecha; no publica registros.
- Una vista previa fija lote, alcance, versión y hash. Solo un plan vigente y sin bloqueos puede promoverse.
- La promoción reclama el plan y vuelve a validar dentro de una transacción serializable. Una excepción revierte el alcance completo.

## Tipos admitidos

| Tipo | Requiere | Publica | Control principal |
|---|---|---|---|
| `MEMBER_CREATE` | Nombre, cuerda, vigencia y estado confirmados | Miembro y primera asignación de cuerda | Un nombre normalizado existente bloquea la creación; debe enlazarse |
| `IDENTITY_LINK` | Miembro elegido y nombre fuente | Trazabilidad hacia el miembro existente | Una sugerencia aproximada nunca elige por sí sola |
| `SECTION_ASSIGNMENT` | Miembro, cuerda y vigencia | Asignación histórica | No inventa inicio o fin; actualiza cuerda actual solo si es la asignación más reciente |
| `CHARGE` | Miembro, concepto, período, importe y vencimiento opcional | Cargo | Reutiliza la clave natural; una diferencia de importe bloquea |
| `LEGACY_ALLOCATION` | Miembro, concepto, período, cargo y aplicado | Cargo si falta, parte LEGACY y aplicación | No crea movimiento, no afecta caja y permite fecha aplicada nula |
| `MONEY_MOVEMENT` | Cuenta, tipo, dirección, importe y fecha real aprobada | Movimiento confirmado | Pago/interés son entrada; gasto es salida; sin fecha no valida |
| `OPENING_BALANCE` | Cuenta, importe, dirección, corte y descripción | Movimiento de apertura | El corte debe aprobarse expresamente y la apertura se excluye del ingreso externo |

## Alcances

- `MEMBERS`: altas, enlaces y cuerdas.
- `FINANCE`: cargos, aplicaciones LEGACY, movimientos y aperturas.
- `ALL_APPROVED`: todos los tipos aprobados.

Cada alcance es atómico. Si una fila financiera depende de un miembro nuevo, se promueve primero `MEMBERS`, se enlaza explícitamente la fila financiera al ID creado y se aprueba una versión nueva antes de `FINANCE`.

## Idempotencia y procedencia

Las claves de origen usan SHA-256 de archivo, ID estable de fila y tipo de destino. `ImportPublication` enlaza la fila con cada miembro, asignación, cargo, parte, aplicación o movimiento. Constraints únicos protegen las publicaciones, miembros importados, asignaciones, partes LEGACY, cargos y movimientos.

Un reintento de un plan promovido devuelve el mismo plan. Dos solicitudes concurrentes compiten por el mismo estado y los constraints/transacciones impiden duplicación. Una fila publicada queda bloqueada para edición; no se borra para “corregirla”.

Entre versiones, una coincidencia exacta exige una huella de contenido única; una modificación exige una clave semántica única en ambas versiones. Duplicados o múltiples candidatos quedan `AMBIGUOUS`. Una fila ausente se conserva en la versión anterior y una publicación existente prevalece como `ALREADY_IMPORTED`.

## Reglas de rechazo

La promoción se bloquea si falta una identidad, cuerda, concepto o cuenta; si el mapeo está obsoleto; si un nombre nuevo coincide con otro miembro; si dos filas proponen el mismo cargo; si el importe difiere del cargo existente; si las aplicaciones exceden el cargo; si un movimiento no tiene fecha real; o si dirección y tipo no son coherentes.

Los subtotales, encabezados, informes y filas ambiguas se marcan `REJECTED`; rechazarlos no elimina la evidencia del staging.

## Fechas y caja

`period` identifica la obligación. `dueOn` es vencimiento. `appliedOn` es fecha de aplicación histórica y puede ser nula. `occurredOn` es la fecha real de un movimiento y es obligatoria para publicarlo. `cutoffOn` pertenece a una apertura aprobada. Ninguna usa automáticamente la fecha de carga.

Una aplicación LEGACY usa `PaymentPart.movementId=null`, `isLegacy=true`, `cashEffect=false` y `receivedAt=null`. Reduce el saldo del cargo, pero no aumenta una cuenta, ingreso externo ni “importe identificado” de un depósito.
