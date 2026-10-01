# Voces de Esperanza

Aplicación privada y responsive para miembros, cuotas, pagos, conciliación, incidencias, actividades y asistencia del coro. Usa Next.js 16, TypeScript, PostgreSQL, Prisma y Better Auth en un único proyecto.

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

## Documentación

- `PROMPT-CODEX.md`: alcance funcional y reglas.
- `docs/MIGRACION-Y-PRUEBAS.md`: estrategia y 50 criterios de aceptación.
- `docs/INFORME-IMPORTACION.md`: estado no nominativo del importador.
- `docs/ESTADO-IMPLEMENTACION.md`: alcance implementado, evidencia ejecutada y pendientes reales.
- `docs/DEPLOY-COOLIFY.md`: despliegue, dominio, volumen, cron y restauración.

`private/`, Excel, comprobantes, respaldos y el diagnóstico confidencial están ignorados por Git y Docker.
