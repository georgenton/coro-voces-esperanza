# Migración y pruebas de aceptación

## 1. Separar cuatro fechas y dos libros
Fecha real de movimiento, fecha de registro, período al que se aplica y fecha de corte del reporte son diferentes. Los campos desconocidos permanecen nulos y exigen revisión; nunca usar la fecha de importación como fecha de depósito.

Mantener libro de caja por cuenta y libro de obligaciones/aplicaciones por miembro. Una aplicación histórica sin movimiento verificable no crea dinero en caja.

## 2. Estrategia inicial: histórico + apertura aprobada + actividad nueva
El corte 31-08-2026 es una propuesta porque existe ese informe, no una conciliación aprobada. La matriz puede haber sido actualizada después: sus columnas futuras no prueban que los pagos fueran recibidos antes del corte.

1. Leer el original sin ejecutarle macros ni enlaces; preservar hash, hojas y valores/formulas. Limitar tamaño de archivo y expansión del ZIP XLSX.
2. Crear un lote de staging; sin publicar deudas, crear cobros o mover dinero.
3. Catalogar identidades con ID estable; conservar nombres originales, alias sugeridos y fuentes. No fusionar por nombre aproximado. Cuerdas con vigencia.
4. Las filas de directora son personas con papel administrativo, no grupos vocales ficticios. Excluir encabezados, subtotales y agregados de personas desconocidas.
5. Clasificar marcas según columna. X mensual de cuotas -> exención histórica propuesta; X en deuda anterior -> ausencia de valor numérico de deuda, no una pausa. Vacío -> no especificado.
6. Aprobar deuda anterior indicada por la matriz como cargo de apertura. El histórico 2025 queda de consulta: no generar otra vez cargos impagos de 2025 cubiertos por ese saldo.
7. Generar cargos 2026 según vigencias/excepciones aprobadas. Aplicar las cantidades de la matriz a sus períodos mediante registros LEGACY: `cashEffect=false`, `paymentDate=null` cuando no se conozca.
8. Las columnas futuras se preservan como aplicaciones a esos períodos; si la fecha real es desconocida, no etiquetar “anticipo recibido al corte” como hecho comprobado.
9. Importar hojas mensuales como archivo histórico o candidatos de movimiento, NO también como pagos nuevos sobre las mismas aplicaciones de la matriz. Enlazar las fuentes solo si están conciliadas, con relación e importe consistentes.
10. Elegir saldo de apertura por cuenta contra evidencia bancaria. Los movimientos anteriores no se vuelven a sumar a esa apertura. Para reportes de historia, usar un rango sin mezclar la apertura posterior.
11. Revisar operaciones posteriores, detectando coincidencias con aplicaciones ya existentes. Enlazar o corregir, nunca aplicar dos veces una misma entrada.
12. Guardar aprobación, conteos, diferencias, usuario y fecha. Cualquier inconsistencia queda en lista de revisión y no desaparece porque cuadre un total.

No importar todas las cantidades numéricas del workbook: en matrices son aplicaciones, en ahorros pueden ser transferencias, en reportes son agregados, en caja hay saldos de arrastre.

## 3. Fuentes y prioridades

| Fuente | Papel principal | No hacer |
|---|---|---|
| Matriz 2026 | Foto de aplicaciones y saldo anterior por persona | Crear fechas bancarias ficticias |
| Matriz 2025 | Histórico de períodos y marcas | Duplicar deuda inicial 2025 en 2026 |
| Hojas mensuales | Movimientos de caja con observaciones | Sumar fila de apertura y totales como operaciones |
| Ahorro | Contraste de transferencias/intereses | Gastar contablemente las transferencias entre cuentas |
| Parqueadero/actividades | Detalle de distribución | Registrar otra entrada que ya existe en caja |
| Retirados | Histórico y posibles incidencias | Duplicar los aportes presentes en otras hojas |
| Informe agosto | Comparación y reglas de ese informe | Importar sus totales como nuevos saldos o recibos |

Ninguna fuente se considera infalible. Conflictos conservan ambas evidencias y exigen decisión, no una prioridad ciega.

## 4. Dinero, identidad y trazabilidad
Usar enteros de centavos, constraints y transacciones reales. Cada fila importada debe guardar origen y estado. La idempotencia requiere hash de lote/archivo y claves de registros; un archivo editado requiere comparación por registros, no solo otro hash global.

En un cierre, reportar total leído, aceptado, rechazado, pendiente y enlazado, con importes. La aprobación no puede ignorar los pendientes sin mostrarlos. Una reversión de importación solo se permite con trazabilidad; si ya existen operaciones posteriores, usar reversos y no borrado destructivo.

Los fixtures con nombres reales están en `private/`, fuera de Git. Las pruebas públicas deben usar personas ficticias. Ejecutar pruebas de importación real solo localmente y sin subir resultados identificables a CI pública.

## 5. Pruebas mínimas de la aplicación a implementar

| ID | Escenario | Resultado requerido |
|---|---|---|
| C01 | Miembro activo en febrero, cuota 500 centavos | Un solo cargo de USD 5 |
| C02 | Ejecutar generación del mismo mes dos veces y concurrentemente | Un solo cargo por miembro/concepto/período |
| C03 | Enero de cualquier año | No genera cuota ordinaria; sí acepta pagos para otros períodos |
| C04 | Junio 2026 con excepción; junio 2027 sin excepción | No cargo en primero; cargo normal en segundo |
| C05 | Pausa aprobada mayo–julio, ingreso/reingreso agosto | Meses afectados no exigibles, agosto exigible según regla aprobada |
| C06 | Alta o retiro a mitad de mes sin decisión de cobro | Revisión pendiente, no deuda inventada |
| C07 | Retiro hoy con deuda anterior | Conserva deuda anterior y detiene cargos futuros según vigencia |
| C08 | Cambio retroactivo de pausa con cargos pagados | Vista previa y ajustes auditados, sin pérdida del historial |
| C09 | Una falta a ensayo | No modifica cuotas ni parqueadero |
| C10 | Parqueadero solo para inscritos | No cobra a otros; conserva vigencias y tarifa histórica |
| C11 | Importe histórico 5 de parqueadero febrero 2025 | Conserva 5 y genera revisión; no cambia a 2 |
| C12 | Pago 12 distribuido 5+5+2 entre dos personas | Una entrada por 12 y asignaciones exactas |
| C13 | Pago 21 para 3 meses de cuota + parqueadero | Una entrada y seis aplicaciones que suman 21 |
| C14 | Pago parcial 3 a cuota 5 | Saldo 2; estado parcial |
| C15 | Pago 20 a cargos por 15 | Crédito visible 5; no ingreso 25 ni aplicación excesiva |
| C16 | Reparto por 13 de un depósito 12 | Rechazo, sin cambios parciales |
| C17 | Dos confirmaciones concurrentes contra el mismo saldo | No sobreaplicar; constraint/transacción evita duplicación |
| C18 | Comprobante enviado por un miembro | Pendiente; no altera caja ni deuda hasta verificación |
| C19 | Misma evidencia, lote repetido o misma referencia bancaria | No duplicar; enlazar respaldo existente |
| C20 | Dos depósitos legítimos mismo día/monto sin referencia fiable | Alerta revisable, no eliminación automática |
| C21 | Nombre exacto con dos miembros posibles | Revisión; no asignación arbitraria |
| C22 | Alias de tercero aprobado para una familia | Sugerencia, pero distribución requiere confirmación |
| C23 | Imagen ilegible, monto ausente, operación fallida o pendiente | No crear pago confirmado; corrección manual posible |
| C24 | Texto malicioso dentro del recibo | Tratado como dato, sin ejecutar instrucciones |
| C25 | Sin clave/proveedor IA | Registro manual y carga de evidencia funcionan; aviso honesto |
| C26 | Imagen con varios depósitos o varios respaldos de uno | Extracción/agrupación correcta, un movimiento por operación real |
| C27 | Ahorro interno 100 y luego interés 1 | Consolidado: transferencia neutra, ingreso externo 1 |
| C28 | Reverso/devolución de pago ya aplicado | Anula aplicaciones y reabre saldo con auditoría |
| C29 | Exención/adelanto/deuda anterior | No neteo silencioso ni inclusión de deuda como ingreso |
| C30 | Informe agosto bajo sus hipótesis | 880 aplicaciones, 730 a feb–ago, 150 a sep–dic, deuda 155+295; 13 vs 14 pendientes según métrica |
| C31 | Reimportar matriz, reportes y caja | No multiplicar ingresos ni deudas |
| C32 | Importar solo datos por mes sin fecha del depósito | Fecha bancaria nula; período preservado |
| C33 | Jefe intenta URL/API/exportación de otra cuerda | 403/404 apropiado; cero datos filtrados |
| C34 | Miembro altera memberId en una solicitud | No lee ni modifica a terceros |
| C35 | Acceso anónimo a datos privados o adjuntos | Denegado; no exposición por caché o enlace directo |
| C36 | Cambio/revocación de rol | Se aplica en la siguiente operación; sesión no conserva privilegios viejos |
| C37 | QR válido + sesión individual + ventana abierta | Una asistencia con hora del servidor |
| C38 | QR repetido / dos solicitudes concurrentes | Una asistencia, conserva primera hora |
| C39 | Token alterado, vencido, de otro ensayo o fuera de ventana | Rechazo |
| C40 | QR compartido y usuario no autenticado | Exige identidad individual; no selector abierto de nombres |
| C41 | No teléfono / sin conexión | Registro manual autorizado auditado; no fingir sincronización |
| C42 | Ensayo cancelado o miembro no convocado/pausado | No genera falta ni empeora porcentaje |
| C43 | Reiniciar contenedor | Conserva PostgreSQL y adjuntos |
| C44 | Restaurar backup en entorno separado | Recupera datos y comprobantes accesibles con permisos |
| C45 | Producción sin secretos/configuración esencial | Falla de forma segura; sin credenciales demo |
| C46 | Cambiar corte de reporte | No convierte períodos futuros en mora ni mezcla caja con aplicaciones |
| C47 | Camisetas financiadas por el coro y pagos de participantes | Compra = salida; cuotas = recuperación; financiación interna no duplica ingreso |
| C48 | Menú oculto pero endpoint disponible | Servidor mantiene el mismo control de acceso |
| C49 | X en deuda anterior vs X mensual | Semánticas distintas, sin pausa inferida en columna de deuda |
| C50 | Pipeline de importación con filas ambiguas | Totales de pendientes visibles; no aprobar silenciosamente |

## 6. Evidencia de entrega
El agente debe informar comandos y resultados reales. Un `build` correcto no demuestra conciliación ni seguridad de permisos. Exigir pruebas de integración y E2E además de unitarias.

El código `reference/` del paquete solo comprueba algunas reglas puras y el staging calculado. No sustituye estas 50 pruebas de aplicación.
