(() => {
  'use strict';
  const form = document.getElementById('checkout-form');
  const box = document.getElementById('demo-order');
  const cfg = window.DROPLUX_ORDER_CONFIG || {};
  if (!form || !box) return;
  const submit = form.querySelector('button[type="submit"]');
  const notice = document.querySelector('#checkout-overlay .notice');
  const consent = form.querySelector('.checkbox-line');
  const money = n => new Intl.NumberFormat('es-MX', {
    style:'currency', currency:'MXN', maximumFractionDigits:0
  }).format(n);
  const safe = value => String(value || '').replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const whatsappNumber = '523340637423';
  let requestId = null, sent = false, widgetId = null, sending = false;
  const enabled = cfg.enabled === true &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/crear-pedido$/.test(cfg.endpoint || '') &&
      /^[a-zA-Z0-9_-]{15,}$/.test(cfg.turnstileSiteKey || '');
  const progress = document.createElement('p');
  progress.id = 'real-order-status';
  progress.setAttribute('role','status');
  progress.style.cssText = 'font-size:12px;line-height:1.65;color:#253a3e;margin:12px 0';
  const widgetHost = document.createElement('div');
  widgetHost.id = 'droplux-human-check';
  widgetHost.style.margin = '12px 0 20px';
  const actions = form.querySelector('.form-actions');
  if (actions) {
    form.insertBefore(widgetHost,actions);
    actions.insertAdjacentElement('afterend',progress);
  } else {
    form.appendChild(widgetHost);
    form.appendChild(progress);
  }
  if (consent) consent.innerHTML = '<input type="checkbox" required name="aviso_privacidad"/> Acepto el <a href="/privacidad.html" target="_blank" rel="noopener" style="color:#136d5b;text-decoration:underline">aviso de privacidad</a> para tramitar mi pedido.';
  if (enabled) {
    const label = document.querySelector('#checkout-overlay .modal-head .eyebrow');
    if (label) label.textContent = 'PEDIDO SEGURO';
  }
  if (notice) notice.textContent = enabled
    ? 'Tu folio se asigna y guarda de forma segura. El envío a tu domicilio se cotiza antes de confirmar el importe a transferir. No pagues hasta recibir la confirmación.'
    : 'Estamos terminando de configurar el registro seguro de pedidos. Puedes explorar todos los perfumes y pedir una cotización por WhatsApp. No realices transferencias todavía.';
  if (!enabled) {
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Pedidos en preparación';
      submit.style.cssText='opacity:.62;cursor:not-allowed';
    }
    progress.textContent = 'El sistema de folios aún no está activado. No generaremos números de prueba.';
  } else {
    if (submit) submit.textContent = 'Registrar pedido y obtener folio';
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.defer=true;
    script.onload=()=>setupWidget();
    script.onerror=()=>{progress.textContent='No pudimos cargar la verificación de seguridad. Comprueba tu conexión.'};
    document.head.appendChild(script);
  }
  const cartItems = () => {
    let saved = {};
    try { saved=JSON.parse(localStorage.getItem('droplux_cart_v2') || '{}') || {} } catch {}
    return Object.entries(saved).filter(([id,qty]) =>
      /^[GO]\d{3}$/.test(id) && Number.isInteger(qty) && qty > 0 && qty <= 20
    ).map(([id,qty]) => ({id,qty}));
  };
  function setupWidget() {
    if (!enabled || widgetId !== null || !window.turnstile || !widgetHost) return;
    try {
      widgetId = window.turnstile.render(widgetHost, {
        sitekey: cfg.turnstileSiteKey,
        theme:'light',
        'expired-callback': () => { progress.textContent='La verificación caducó. Confirma de nuevo antes de registrar.'; }
      });
    } catch { progress.textContent='No se pudo mostrar la verificación. Actualiza la página.'; }
  }
  const checkoutBtn = document.getElementById('go-checkout');
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => { setTimeout(setupWidget, 50); });
  // Capture phase: bloquea el antiguo generador local de folios de demostración.
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (!enabled || sent || sending) return;
    if (!form.reportValidity()) return;
    setupWidget();
    const token = widgetId !== null && window.turnstile ?
      window.turnstile.getResponse(widgetId) : null;
    if (!token) {
      progress.textContent='Completa la verificación de seguridad para continuar.';
      return;
    }
    const items=cartItems();
    if (!items.length) {progress.textContent='Tu bolsa está vacía. Agrega un perfume primero.';return;}
    const fields=new FormData(form);
    if (!requestId) requestId=crypto.randomUUID();
    const payload={
      request_id:requestId,
      customer_name:String(fields.get('nombre')||'').trim(),
      customer_phone:String(fields.get('telefono')||'').trim(),
      customer_email:String(fields.get('correo')||'').trim(),
      shipping_address:{
        cp:String(fields.get('cp')||'').trim(),
        calle:String(fields.get('calle')||'').trim(),
        colonia:String(fields.get('colonia')||'').trim(),
        municipio:String(fields.get('municipio')||'').trim(),
        estado:String(fields.get('estado')||'').trim(),
        referencias:String(fields.get('referencias')||'').trim()
      },
      items, turnstile_token:token
    };
    sending = true;
    if (submit) {submit.disabled=true;submit.textContent='Registrando tu pedido…';}
    progress.textContent='Conectando con el registro seguro de pedidos…';
    try {
      const response=await fetch(cfg.endpoint,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),cache:'no-store',mode:'cors',
        signal:AbortSignal.timeout(17000)
      });
      const result=await response.json();
      if (!response.ok || !result.registrado || !/^[A-Z]{1,4}-\d{3}$/.test(result.folio||'')) {
        throw new Error(typeof result.error==='string' ? result.error : 'No se pudo registrar el pedido.');
      }
      sent=true;
      const folio=safe(result.folio);
      const total=Number(result.total_productos_mxn);
      const amount=Number.isFinite(total)?money(total):'por confirmar';
      const message='Hola DropLux, mi folio es '+result.folio+
        '. Quiero confirmar la disponibilidad, el costo de envío y el total final antes de transferir.';
      const href='https://wa.me/'+whatsappNumber+'?text='+encodeURIComponent(message);
      box.innerHTML='<span class="eyebrow">PEDIDO REGISTRADO</span>'+
        '<strong class="order-folio">'+folio+'</strong>'+
        '<p>Productos: <b>'+safe(amount)+'</b><br>Envío: <b>por cotizar</b></p>'+
        '<p><b>Importante:</b> todavía no transfieras. Confirma por WhatsApp la disponibilidad, el envío y el monto final.</p>'+
        '<a class="proof-whatsapp" href="'+safe(href)+'" target="_blank" rel="noopener noreferrer" '+
        'style="display:inline-block;background:#16814b;color:white;padding:13px 18px;border-radius:8px;text-decoration:none;font-weight:700">'+
        '✆ Abrir WhatsApp con mi folio ↗</a>'+
        '<p>Cuando te confirmemos el monto y realices la transferencia, envía el comprobante por ese mismo chat junto con tu folio.</p>';
      box.hidden=false;
      progress.textContent='Pedido guardado correctamente. Conserva tu folio.';
      if (submit) submit.textContent='Pedido registrado';
      box.scrollIntoView({behavior:'auto',block:'nearest'});
    } catch (err) {
      const msg=err && err.name==='TimeoutError'
        ? 'La conexión tardó demasiado. Intenta de nuevo: conservaremos el mismo identificador para evitar duplicados.'
        : err instanceof Error ? err.message : 'No se pudo conectar con el registro.';
      progress.textContent=msg;
      if (submit) {submit.disabled=false;submit.textContent='Reintentar registro';}
      if (widgetId!==null && window.turnstile) window.turnstile.reset(widgetId);
    } finally {
      sending=false;
    }
  }, true);
})();