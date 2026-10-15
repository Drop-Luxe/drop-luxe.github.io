# DropLux: conexión con Supabase

**Estado: pendiente de conectar un proyecto real, ejecutar migración y desplegar función.** Tener los archivos en GitHub no crea registros en Supabase.

## 1. Base de datos privada
En SQL Editor del proyecto de Supabase, ejecutar `backend/02_pedidos_seguros.sql`.
La tabla `droplux_orders` no tiene acceso público; cada registro usa una secuencia que emite D-001…D-999, E-001…

## 2. Función para crear pedidos
Desplegar `supabase/functions/crear-pedido/index.ts` como función Edge `crear-pedido` (verify_jwt = false).
La función recalcula el precio desde `prices.ts`, valida los productos y verifica Turnstile antes de guardar.
Configurar `TURNSTILE_SECRET_KEY` en **Supabase Secrets** para el dominio `drop-luxe.github.io`.
Mantener `SUPABASE_SERVICE_ROLE_KEY` solo del lado del servidor. No enviarla al chat ni subirla a GitHub.

## 3. Integración que aún falta en la tienda
Al mostrar el formulario de envío, insertar widget Turnstile con su site key pública.
Al confirmar, generar `request_id` UUID y POST a:
`https://<ID_PROYECTO>.supabase.co/functions/v1/crear-pedido`
con `request_id`, `customer_name`, `customer_email`, `customer_phone`,
`shipping_address` (cp,calle,colonia,municipio,estado,referencias),
`items` ([{id,qty}]), `turnstile_token`.
La API solo devuelve un folio tras guardar el pedido.

**IMPORTANTE:** el enlace actual de la tienda es una demostración; no usar folios locales como folios reales.
No mostrar instrucciones para transferir ni datos bancarios hasta que los pedidos se guarden de forma fiable,
se cotice el envío final y se publique aviso de privacidad.

## 4. Pruebas de aceptación antes de cobrar
- Desde dos navegadores distintos hacer pedidos simultáneos y confirmar folios distintos.
- Reintentar con el mismo UUID y confirmar que devuelve el mismo folio.
- Enviar un precio alterado y comprobar que se ignora y se recalcula del catálogo del servidor.
- Confirmar que ningún usuario anónimo pueda consultar direcciones ni teléfonos.
- Comprobar WhatsApp + folio + comprobante y confirmación manual del pago.
