/* DropLux — luxury v2 interactions. Decorative layer, no change to product/cart/checkout pricing logic. */
(() => {
  'use strict';
  const products = Array.isArray(window.DROPLUX_PRODUCTS) ? window.DROPLUX_PRODUCTS : [];
  if (!products.length) return;
  const find = id => products.find(p => p.id === id);
  const money = amount => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN',maximumFractionDigits:0}).format(amount);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const picks = ['O022','O016','O004'].map(find).filter(Boolean);
  const heroProduct = picks[0] || products.find(p => p.type === 'Original') || products[0];

  const heroCopy = document.querySelector('.hero-copy');
  if (heroCopy) {
    const eyebrow = heroCopy.querySelector('.eyebrow');
    const heading = heroCopy.querySelector('h1');
    const description = heroCopy.querySelector('.hero-description');
    if (eyebrow) eyebrow.textContent = 'MAISON DROP LUX · PERFUMERÍA SELECTA';
    if (heading) heading.innerHTML = 'Hay aromas que <br><em>dejan huella.</em>';
    if (description) description.textContent = 'Fragancias extraordinarias, elegidas para contar tu historia. Descubre nuestra colección original y nuestra línea alternativa G5, con atención personalizada en México.';
  }

  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual && heroProduct && /^data:image\//.test(heroProduct.image || '')) {
    heroVisual.innerHTML = `
      <div class="lux-hero-vitrine">
        <button class="lux-hero-image-button" type="button" data-lux-open="${esc(heroProduct.id)}" aria-label="Descubrir ${esc(heroProduct.brand)} ${esc(heroProduct.name)}">
          <img src="${heroProduct.image}" alt="Perfume original ${esc(heroProduct.brand)} ${esc(heroProduct.name)}" decoding="async">
        </button>
        <div class="lux-hero-logo" aria-label="DropLux"><span class="mark">✧</span><strong>DROP<span>LUX</span></strong><small>FRAGANCIAS QUE DEJAN HUELLA</small></div>
        <div class="lux-hero-micro">EXCLUSIVA SELECCIÓN ORIGINAL <span aria-hidden="true">✧</span></div>
      </div>`;
  }

  const benefit = document.querySelector('.benefit-bar');
  if (benefit && picks.length) {
    const featured = document.createElement('section');
    featured.className = 'lux-featured';
    featured.setAttribute('aria-labelledby','lux-featured-title');
    const name = p => p.id === 'O016' ? 'Stronger With You Intensely' : p.name;
    featured.innerHTML = `
      <div class="container">
        <div class="lux-featured-head lux-reveal">
          <div><p class="section-kicker">CURADURÍA DROP LUX · LOS DESTACADOS</p><h2 id="lux-featured-title">Íconos de la <em>perfumería.</em></h2></div>
          <p>Una selección de nuestra colección original. Explora cada pieza y descubre sus detalles con una experiencia única.</p>
        </div>
        <div class="lux-featured-grid">
        ${picks.map((p,i) => `
          <article class="lux-feature-card lux-reveal">
            <span class="lux-feature-index">0${i + 1}</span>
            <button class="lux-feature-photo" type="button" data-lux-open="${esc(p.id)}" aria-label="Ver ${esc(p.brand)} ${esc(name(p))}">
              <img src="${p.image}" loading="lazy" decoding="async" alt="Perfume ${esc(p.brand)} ${esc(name(p))}">
            </button>
            <div class="lux-feature-detail">
              <div class="lux-feature-brand">${esc(p.brand)} · ORIGINAL</div>
              <h3 class="lux-feature-name">${esc(name(p))}</h3>
              <div class="lux-feature-bottom"><strong>${money(p.price)}</strong><button type="button" data-lux-open="${esc(p.id)}">Descubrir ↗</button></div>
            </div>
          </article>`).join('')}
        </div>
      </div>`;
    benefit.insertAdjacentElement('afterend', featured);
  }

  const overlay = document.createElement('div');
  overlay.className = 'lux-overlay';
  overlay.id = 'lux-product-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="lux-modal" role="dialog" aria-modal="true" aria-labelledby="lux-modal-name" aria-describedby="lux-modal-desc">
      <button type="button" class="lux-modal-close" aria-label="Cerrar detalles del perfume" data-lux-close>×</button>
      <div class="lux-modal-stage">
        <img id="lux-modal-image" alt="">
        <span class="lux-modal-mark" aria-label="DropLux">DROP<span>LUX</span></span>
      </div>
      <div class="lux-modal-copy">
        <div class="lux-modal-kicker" id="lux-modal-category"></div>
        <h2 id="lux-modal-name"></h2>
        <div class="lux-modal-hr"></div>
        <p class="lux-modal-text" id="lux-modal-desc"></p>
        <div class="lux-modal-price" id="lux-modal-price"></div>
        <div class="lux-modal-status" id="lux-modal-status"></div>
        <button type="button" class="lux-modal-buy" id="lux-modal-buy">Agregar a mi bolsa &nbsp; ↗</button>
        <button type="button" class="lux-modal-back" data-lux-close>Seguir explorando</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const modalImage = overlay.querySelector('#lux-modal-image');
  const modalCategory = overlay.querySelector('#lux-modal-category');
  const modalName = overlay.querySelector('#lux-modal-name');
  const modalDesc = overlay.querySelector('#lux-modal-desc');
  const modalPrice = overlay.querySelector('#lux-modal-price');
  const modalStatus = overlay.querySelector('#lux-modal-status');
  const modalBuy = overlay.querySelector('#lux-modal-buy');
  let active = null, returnFocus = null;

  function openModal(p, source) {
    if (!p) return;
    active = p;
    returnFocus = source instanceof HTMLElement ? source : document.activeElement;
    const isMist = p.brand === "VICTORIA'S SECRET";
    const category = isMist ? 'BODY MIST · ORIGEN POR CONFIRMAR' :
      p.type === 'G5' ? 'LÍNEA ALTERNATIVA G5 · NO ORIGINAL' : 'PERFUMERÍA ORIGINAL';
    modalCategory.textContent = category;
    modalName.textContent = p.id === 'O016' ? 'Stronger With You Intensely' : p.name;
    modalDesc.textContent = isMist
      ? 'Body mist. Se verificará el origen y la disponibilidad al confirmar tu pedido.'
      : p.type === 'G5'
        ? 'Fragancia de línea alternativa G5. No es un producto original de la marca mencionada; la imagen se presenta únicamente como referencia.'
        : 'Una pieza de nuestra colección de perfumería original. Selecciona tu fragancia y consulta la disponibilidad y entrega de tu pedido.';
    modalPrice.textContent = money(p.price);
    modalStatus.textContent = p.available || 'Sobre pedido · Sujeto a confirmación';
    modalImage.src = p.image;
    modalImage.alt = p.brand + ' ' + p.name;
    overlay.hidden = false;
    document.body.classList.add('lux-modal-open');
    overlay.querySelector('.lux-modal-close').focus({preventScroll:true});
    if (!reducedMotion && typeof modalImage.animate === 'function') {
      modalImage.animate([
        {opacity:0,transform:'translateY(50px) scale(.72) rotate(-8deg)',filter:'blur(6px)'},
        {opacity:1,transform:'translateY(0) scale(1) rotate(0)',filter:'blur(0px)'}
      ], {duration:850,easing:'cubic-bezier(.15,.84,.25,1)',fill:'both'});
    }
  }

  function closeModal() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('lux-modal-open');
    active = null;
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
      returnFocus.focus({preventScroll:true});
    }
  }

  function addThroughExistingCart(p) {
    const grid = document.getElementById(p.type === 'Original' ? 'grid-original' : 'grid-g5');
    if (!grid) return;
    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.hidden = true;
    proxy.dataset.add = p.id;
    grid.appendChild(proxy);
    proxy.click(); /* Triggers the original, delegated cart add handler, including promotions. */
    proxy.remove();
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-lux-open]');
    if (trigger) {
      event.preventDefault();
      openModal(find(trigger.dataset.luxOpen), trigger);
      return;
    }
    const visual = event.target.closest('#grid-original .product-image, #grid-g5 .product-image, #grid-original .product-name, #grid-g5 .product-name');
    if (visual) {
      const card = visual.closest('.product-card');
      const id = card?.querySelector('[data-add]')?.dataset.add;
      if (id) openModal(find(id), visual);
      return;
    }
    if (event.target.closest('[data-lux-close]')) {
      closeModal();
      return;
    }
    if (event.target === overlay) closeModal();
  });

  modalBuy.addEventListener('click', () => {
    if (!active) return;
    const p = active;
    addThroughExistingCart(p);
    closeModal();
  });

  document.addEventListener('keydown', event => {
    if (!overlay.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeModal();
        return;
      }
      if (event.key === 'Tab') {
        const focusables = [...overlay.querySelectorAll('button:not([disabled])')];
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
      }
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.product-image, .product-name') &&
      event.target.closest('#grid-original, #grid-g5')) {
      event.preventDefault();
      const id = event.target.closest('.product-card')?.querySelector('[data-add]')?.dataset.add;
      if (id) openModal(find(id), event.target);
    }
  }, true);

  function makeCatalogClickable(host) {
    host.querySelectorAll('.product-image, .product-name').forEach(el => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0');
      el.setAttribute('role','button');
      el.setAttribute('aria-haspopup','dialog');
      const card = el.closest('.product-card');
      const id = card?.querySelector('[data-add]')?.dataset.add;
      const p = id && find(id);
      if (p) el.setAttribute('aria-label','Ver detalles de ' + p.brand + ' ' + p.name);
    });
  }
  ['grid-original','grid-g5'].forEach(id => {
    const host = document.getElementById(id);
    if (!host) return;
    makeCatalogClickable(host);
    new MutationObserver(() => { makeCatalogClickable(host); scheduleReveals(host); }).observe(host,{childList:true,subtree:true});
  });

  let io = null;
  if ('IntersectionObserver' in window && !reducedMotion) {
    io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    }, {threshold:.06,rootMargin:'0px 0px 35px 0px'});
  }
  function scheduleReveals(root) {
    const nodes = root.querySelectorAll('.product-card,.brand-heading');
    nodes.forEach((node,i) => {
      if (node.dataset.luxObserved) return;
      node.dataset.luxObserved = '1';
      node.classList.add('lux-reveal');
      node.style.transitionDelay = (i % 4) * 50 + 'ms';
      if (io) io.observe(node);
      else node.classList.add('is-visible');
    });
  }
  document.querySelectorAll('.lux-featured .lux-reveal,.section-heading,.promo-card,.wholesale-card,.step-grid article').forEach((node,i) => {
    node.classList.add('lux-reveal');
    node.style.transitionDelay = (i % 3) * 85 + 'ms';
    if (io) io.observe(node);
    else node.classList.add('is-visible');
  });
  ['grid-original','grid-g5'].forEach(id => {
    const el = document.getElementById(id);
    if (el) scheduleReveals(el);
  });
})();