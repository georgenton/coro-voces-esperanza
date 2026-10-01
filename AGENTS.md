# AGENTS.md — Voces de Esperanza

## Objetivo
Una aplicación pequeña para un coro: cuotas, tesorería, conciliación, incidencias y asistencia. Leer `PROMPT-CODEX.md` y los documentos de `docs/` antes de implementar. El paquete inicial no es una aplicación web terminada.

## Límites
- Un proyecto full-stack Node/TypeScript/Next.js y PostgreSQL. No SaaS multiempresa, monorepo ni microservicios.
- No tocar proyectos ajenos. Preservar modificaciones locales. Rama `codex/coro-voces-esperanza`.
- La continuación del 1 de octubre de 2026 autoriza, solo para este proyecto, commits y push en `codex/coro-voces-esperanza`, creación y merge de PR a `main` cuando pasen los controles, GitHub Actions, despliegue en el Coolify existente y el cambio DNS mínimo del subdominio aprobado. Esta autorización no alcanza otras aplicaciones, proyectos ni zonas.
- `private/`, el Excel, respaldos, exportaciones y secretos nunca entran a Git, demos, capturas públicas o logs.
- Pruebas y seeds públicos solo con personas ficticias. No usar datos reales para probar APIs de IA.

## Autorización operativa vigente
- Repositorio autorizado: `georgenton/coro-voces-esperanza`; comprobar visibilidad y estado antes de escribir. No cambiar su visibilidad ni desactivar protecciones.
- Infraestructura autorizada: recursos nuevos y exclusivos del coro en `https://ops.syntavera.dev`; no reutilizar ni alterar bases, volúmenes, aplicaciones o secretos de otros proyectos.
- Dominio confirmado por Jorge: `coro.syntavera.dev`, dentro de la zona existente `syntavera.dev`. No crear ni modificar registros en `cintavera.dev`. Hacer únicamente el cambio DNS mínimo si fuese necesario y verificar HTTPS.
- Producción inicia vacía salvo catálogos y un acceso SUPERADMIN aprobado. No sembrar miembros, pagos, saldos o fechas ficticias ni aprobar datos históricos.
- Siguen prohibidos: borrar datos, force push, saltar protecciones, contratar servicios pagos y enviar Excel o comprobantes reales a proveedores de IA no aprobados.

## Invariantes
Dinero en centavos. Cargo != movimiento de dinero != aplicación de pago.
Un depósito admite múltiples miembros/conceptos/períodos. Deuda previa no es ingreso.
Enero exento; junio de 2026 es una excepción histórica de cuotas, no anual.
Pausa y retiro no borran deuda anterior. Ausencia no genera exoneración.
No inferir identidad, deuda ni fecha por un nombre aproximado, vacío o mes de la matriz.
No duplicar datos entre matrices, movimientos, actividades e informes.
Transferencias entre cuentas del coro no son ingresos/gastos consolidados.
IA sugiere, una persona autorizada confirma.
Acceso por objeto en servidor; jefe solo su cuerda, miembro solo sí mismo.
QR con usuario autenticado, ventana y token válidos; una asistencia por persona/ensayo.

## Verificación
Antes de reportar éxito: lint, tipos, pruebas y build de la aplicación. Reportar bloqueos con precisión.
Las reglas de referencia pueden comprobarse desde la raíz:
`node --test reference/finance-rules.test.mjs`
`node reference/verify-legacy.mjs`
Esos comandos no validan una app, PostgreSQL, autenticación, QR ni despliegue.

## Entrega
Implementar por incrementos funcionales y documentar decisiones. No detenerse en una maqueta.
No afirmar datos conciliados, IA probada con banco real o despliegue efectivo sin evidencia.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
