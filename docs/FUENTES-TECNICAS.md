# Fuentes técnicas consultadas
Consulta: 1 de octubre de 2026. Referencias de implementación; las reglas del coro proceden del usuario y del Excel, no de estas páginas.

- Node.js — ciclo y versiones LTS: https://nodejs.org/en/about/previous-releases
  Node 24 figura como LTS; usar parche compatible y soportado al implementar.
- Next.js — despliegue: https://nextjs.org/docs/app/getting-started/deploying
  Puede ejecutarse como servidor Node o contenedor Docker.
- Next.js — self-hosting: https://nextjs.org/docs/app/guides/self-hosting
  Revisar proxy, variables, caché y comportamiento en producción.
- Coolify — Dockerfile: https://coolify.io/docs/applications/builds/dockerfile
  Construcción y configuración de contenedor, dominios, volúmenes y healthchecks.
- OpenAI — instrucciones de Codex: https://developers.openai.com/codex/agent-configuration/agents-md
  Instrucciones de proyecto mediante AGENTS.md.
- OpenAI — imágenes y visión: https://developers.openai.com/api/docs/guides/images-vision
  Entrada de imágenes y limitaciones; lectura asistida no implica exactitud garantizada.
- OpenAI — controles de datos: https://developers.openai.com/api/docs/guides/your-data
  Revisar tratamiento/retención antes de habilitar procesamiento externo de comprobantes.
- OWASP — autorización: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
  Denegar por defecto y comprobar permisos en cada operación.
- OWASP — autenticación: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP — sesiones: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP — CSRF: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

El 1 de octubre de 2026 se verificó `coro.syntavera.dev` en el Coolify autorizado y se publicó la aplicación con HTTPS. No se accedió a cuentas bancarias ni se enviaron datos reales a proveedores de IA. Cloudflare no requirió cambios porque el registro del host ya existía.
