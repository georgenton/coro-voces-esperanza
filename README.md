# Voces de Esperanza

Aplicación privada y responsive para miembros, cuotas, pagos, conciliación, incidencias, actividades y asistencia del coro. Usa Next.js 16, TypeScript, PostgreSQL, Prisma y Better Auth en un único proyecto.

Producción: `https://coro.syntavera.dev`. No existe autorregistro; el histórico permanece pendiente de aprobación y el primer SUPERADMIN requiere una identidad aprobada.

## Requisitos

- Node.js 24 LTS (`.nvmrc`: 24.21.0)
- pnpm 11.19.0
- PostgreSQL 17 o compatible
- Docker y Docker Compose, opcionales

## Desarrollo local

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:dev --name init
pnpm db:seed
pnpm dev
```

Antes del seed, define explícitamente `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` y una `SEED_ADMIN_PASSWORD` de 12 caracteres o más. Los miembros ficticios solo se crean si defines `SEED_SYNTHETIC_DATA=true`; el valor predeterminado seguro crea únicamente catálogos.

La aplicación queda en `http://localhost:3000`. No existe autorregistro público; las cuentas nuevas se activan con enlaces de invitación de un solo uso.

## Comandos

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm db:migrate
pnpm verify:reference
```

Las pruebas de integración necesitan `TEST_DATABASE_URL` o `DATABASE_URL` apuntando a una base desechable. E2E necesita una base migrada y datos sintéticos.

## Docker

Completa `.env` y ejecuta:

```bash
docker compose up --build
```

PostgreSQL no publica puerto. Los adjuntos persisten en el volumen `private_uploads`, fuera de `public/`.

## Principios financieros

- Todos los importes se guardan como centavos enteros.
- Cargo, movimiento de dinero y aplicación de pago son entidades distintas.
- Un pago puede dividirse entre varios miembros, cargos y períodos.
- Crédito, adelanto e importe sin identificar se muestran por separado.
- Las transferencias internas no son ingreso ni gasto consolidado.
- Los movimientos confirmados se corrigen con reversos; no se borran.
- El Excel entra a staging y nunca es la base operativa.
- Aprobar el mapeo y promoverlo son pasos distintos. Cada edición invalida la aprobación anterior.
- Una aplicación histórica `LEGACY` puede reducir un cargo aprobado, pero no crea un movimiento ni altera caja.

## Promoción del histórico

En **Importar Excel** el flujo es: cargar → mapear cada fila → aprobar/excluir filas e incidencias → aprobar la versión completa → generar vista previa por alcance → promover. Los alcances disponibles son todo, miembros/cuerdas o finanzas. Cada promoción es atómica, reintentable e idempotente y conserva archivo, hoja, fila, huella, versión, hash y aprobadores.

No se promueve una identidad aproximada, una fecha desconocida, un cargo con importe diferente, una aplicación excesiva ni un mapeo editado después de aprobarse. Consulta `docs/CONTRATO-PROMOCION.md`.

La vista **Histórico fuente** permite revisar hojas, filas, celdas, fórmulas, incidencias y diferencias entre versiones sin sumar esos datos a la operación. **Reporte mensual** calcula apertura, entradas, salidas y cierre desde movimientos confirmados. **Matriz anual de cuotas** usa cargos y aplicaciones, distingue períodos futuros/no exigibles/sin importar y respeta el alcance global o por cuerda. Ambos informes exportan CSV desde las mismas consultas del servidor.

## Documentación

- `PROMPT-CODEX.md`: alcance funcional y reglas.
- `docs/MIGRACION-Y-PRUEBAS.md`: estrategia y 50 criterios de aceptación.
- `docs/INFORME-IMPORTACION.md`: estado no nominativo del importador.
- `docs/ESTADO-IMPLEMENTACION.md`: alcance implementado, evidencia ejecutada y pendientes reales.
- `docs/DEPLOY-COOLIFY.md`: despliegue, dominio, volumen, cron y restauración.
- `docs/CONTRATO-PROMOCION.md`: contrato de staging, aprobación, vista previa y publicación.
- `docs/MATRIZ-C01-C50.md`: trazabilidad de cada criterio a prueba, comando y evidencia.

`private/`, Excel, comprobantes, respaldos y el diagnóstico confidencial están ignorados por Git y Docker.
