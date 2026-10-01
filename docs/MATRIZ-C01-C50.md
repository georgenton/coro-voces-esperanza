# Matriz de aceptación C01–C50

Fecha de ejecución: 1 de octubre de 2026, `America/Guayaquil`. Los datos de prueba son sintéticos. `PASS` significa evidencia ejecutada en esta sesión; `PARCIAL` significa que el control existe pero falta una prueba completa del escenario; `PENDIENTE` no se considera aceptado.

## Comandos de evidencia

| Clave | Entorno | Comando |
|---|---|---|
| U | macOS, Node 24.19.0 | `pnpm test` |
| R | macOS, Node 24.19.0 | `pnpm verify:reference` |
| I | PostgreSQL 17 aislado en Docker | `pnpm db:migrate && pnpm test:integration` |
| E | Aplicación Docker, Chromium escritorio y Pixel 7 | `E2E_EXTERNAL_SERVER=1 E2E_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e` |
| B | macOS y Docker | `pnpm lint && pnpm typecheck && pnpm build`; `docker build` |
| P | Docker aislado | reinicio, respaldo y restauración descritos en `docs/DEPLOY-COOLIFY.md` |

## Criterios

| ID | Requisito resumido | Prueba / comando | Resultado | Evidencia o brecha precisa |
|---|---|---|---|---|
| C01 | Cuota activa de 500 | U, R | PASS | `rules.test.ts` y reglas de referencia generan 500 centavos. |
| C02 | Generación doble/concurrente | I | PASS | Dos ejecuciones concurrentes conservan un cargo por clave única. |
| C03 | Enero no exigible, pagos permitidos | U, R | PASS | Regla excluye enero; pagos no dependen del mes de recepción. |
| C04 | Junio 2026 excepcional, 2027 normal | U, R | PASS | Excepción fechada y prueba comparativa. |
| C05 | Pausa mayo–julio y reingreso | U, R | PASS | Decisión de elegibilidad por período cubierta en reglas. |
| C06 | Alta/retiro a mitad de mes sin decisión | inspección + generación | PARCIAL | Incidencia pendiente bloquea cargo; falta E2E de selección del período económico. |
| C07 | Retiro conserva deuda anterior | inspección | PARCIAL | El servicio no borra cargos; falta escenario automatizado extremo a extremo. |
| C08 | Pausa retroactiva con cargos pagados | inspección | PARCIAL | Simulación y ajustes auditados implementados; falta prueba con cargo pagado. |
| C09 | Falta no modifica cuotas | inspección | PARCIAL | Asistencia y cargos están desacoplados; falta prueba integrada explícita. |
| C10 | Parqueadero solo inscrito | U, R | PASS | Elegibilidad por incidencia/vigencia y regla específica. |
| C11 | Parqueadero histórico de 500 | R | PASS | Se conserva y marca para revisión. |
| C12 | Depósito 1200 repartido 5+5+2 | I | PASS | Una entrada, dos partes y tres aplicaciones suman 1200. |
| C13 | Depósito 2100 a cuotas y parqueadero | R, U | PASS | Validador admite seis aplicaciones que cuadran con una entrada. |
| C14 | Pago parcial 300 a cargo 500 | U | PASS | Estado parcial y saldo restante en cálculo de asignación. |
| C15 | Pago 2000 a cargos 1500 | U, R | PASS | Crédito no aplicado de 500, sin inflar ingreso. |
| C16 | Reparto 1300 sobre depósito 1200 | U, R | PASS | Rechazo antes de escribir. |
| C17 | Dos confirmaciones concurrentes | I | PASS | Solo una transacción aplica 500; constraint/serialización rechaza la otra. |
| C18 | Comprobante de miembro queda pendiente | inspección, E | PARCIAL | Acción crea evidencia pendiente y anónimo no accede; falta E2E autenticado del miembro. |
| C19 | Evidencia/lote/referencia repetidos | R + inspección | PARCIAL | Hash y referencias únicas implementados; falta integración multipart con dos respaldos. |
| C20 | Depósitos iguales sin referencia | R | PASS | Solo alerta; no genera clave de bloqueo duro. |
| C21 | Dos identidades exactas | R | PASS | Queda ambiguo y sin asignación automática. |
| C22 | Alias familiar aprobado | R | PASS | Solo sugiere; distribución sigue requiriendo confirmación. |
| C23 | Imagen ilegible o incompleta | inspección | PARCIAL | Esquema y estados impiden confirmar campos ausentes; falta fixture de proveedor real. |
| C24 | Texto malicioso en recibo | inspección | PARCIAL | Se trata como cadena no confiable; falta fixture automatizado específico. |
| C25 | Sin proveedor de IA | E + inspección | PASS | Modo manual funciona con `AI_VISION_PROVIDER=disabled`; no se llama a terceros. |
| C26 | Varios depósitos/respaldos | inspección | PARCIAL | Modelo soporta relación muchos-a-muchos; falta prueba de agrupación múltiple. |
| C27 | Transferencia 10000 e interés 100 | I | PASS | Transferencia neta cero e interés como ingreso externo. |
| C28 | Reverso reabre cargo | I | PASS | Reverso conserva movimiento, elimina aplicaciones y deja cargo pendiente. |
| C29 | Exención/adelanto/deuda anterior separados | U, R | PASS | Sin neteo silencioso ni deuda como ingreso. |
| C30 | Totales de referencia del informe | R | PASS | 880=730+150, deuda 155+295=450, 13 vs 14; marcados provisionales. |
| C31 | Reimportación no duplica | I, R | PASS | Segundo XLSX idéntico devuelve el mismo lote; promoción/reintento mantiene publicaciones únicas. |
| C32 | Período sin fecha bancaria | U, I | PASS | LEGACY conserva período, `movementId`/`receivedAt`/`appliedAt` nulos y no crea caja. |
| C33 | Jefe intenta otra cuerda | U | PARCIAL | Autorización por objeto rechaza otra cuerda; falta E2E autenticado de URL/API/exportación. |
| C34 | Miembro altera `memberId` | U | PASS | `canAccessMember` solo permite su ficha y las acciones vuelven a resolver acceso en servidor. |
| C35 | Anónimo/adjunto/caché | E + inspección | PARCIAL | Anónimo recibe 401 y adjunto autorizado usa `private, no-store`; falta descarga E2E autenticada cruzada. |
| C36 | Cambio de rol revoca sesión | I | PASS | Reemplazo de roles elimina sesiones en la misma transacción. |
| C37 | QR válido + sesión + ventana | U, I | PASS | Token válido y check-in usa identidad vinculada/hora del servidor. |
| C38 | QR repetido/concurrente | I | PASS | Constraint único conserva una asistencia y reporta duplicado. |
| C39 | QR alterado/vencido/otro/fuera de ventana | U + inspección | PASS | Firma y vencimiento probados; servicio valida ensayo y ventana. |
| C40 | QR compartido sin sesión | E | PASS | Pantalla privada redirige a acceso individual; no existe selector público de nombres. |
| C41 | Registro manual autorizado | inspección | PARCIAL | Acción auditada por rol/cuerda implementada; falta E2E sin teléfono. |
| C42 | Cancelado/no convocado/pausado | inspección | PARCIAL | Cierre filtra convocatoria/estado; falta matriz integrada de porcentajes. |
| C43 | Reinicio conserva DB y adjunto | P | PENDIENTE | Se completa en el simulacro aislado de persistencia. |
| C44 | Restauración separada | P | PENDIENTE | Se completa con base y volumen nuevos, sin tocar producción. |
| C45 | Falta configuración esencial | B | PASS | Validación de entorno y Compose fallan de forma segura; no hay credenciales demo. |
| C46 | Cambiar corte no mezcla caja/períodos | inspección | PARCIAL | Dashboard filtra cargos por período y caja por movimientos; falta prueba de frontera automatizada. |
| C47 | Compra de actividad y recuperación | I | PASS | Gasto enlazado y movimientos separados; transferencia interna no duplica ingreso. |
| C48 | Menú oculto no abre endpoint | U, E | PARCIAL | Acciones/endpoints autentican en servidor; falta E2E de todos los roles. |
| C49 | X de deuda vs X mensual | R | PASS | Semánticas distintas verificadas. |
| C50 | Filas ambiguas visibles y no aprobables | U, I | PASS | Cero pendientes exigido; hash/version y vista previa bloquean ambigüedad u obsolescencia. |

## Lectura del resultado

Los criterios `PARCIAL` no bloquean la construcción o el despliegue técnico con migración real deshabilitada, pero sí bloquean declarar aceptación operativa completa. Los criterios C43 y C44 deben cambiar a `PASS` únicamente con evidencia del simulacro aislado. Los comprobantes reales y los datos históricos permanecen fuera de CI y fuera de Git.
