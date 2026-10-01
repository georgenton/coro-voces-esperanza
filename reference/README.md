# Referencia Node, no aplicación web

Módulo sin dependencias externas. Comprueba conversión a centavos, semántica de marcas, generación simple de cargos con reglas explícitas, estados de deuda, repartos de pagos, propuestas de identidad y flujo externo consolidado.

No implementa base de datos, concurrencia transaccional, login, permisos, firma QR, lectura de imágenes, pantallas o despliegue. Esas piezas corresponden a la aplicación solicitada en el prompt.

La elegibilidad se pasa como dato aprobado: el módulo no deduce por sí mismo quién estuvo activo ni cómo prorratear un mes parcial. Las pruebas de referencias bancarias solo validan el identificador, no verifican la autenticidad de recibos.

El módulo admite Node 22 para estas comprobaciones; el proyecto nuevo se especifica para Node 24 LTS. Consultar `VERIFICACION.txt` para el entorno y resultados reales.
