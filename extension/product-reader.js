// Self-contained so Chrome can inject this exact function into the current page.
// Reads product content only: no cookies, account details, private endpoints or page scripts.
export function readMorrisonsPage() {
  if (location.origin !== 'https://groceries.morrisons.com') throw new Error('Open a Morrisons groceries page first.');
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const canonical = (value) => {
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin || !/^\/products\/[a-z0-9-]+\/\d+\/?$/i.test(url.pathname)) return null;
      return url.origin + url.pathname.replace(/\/$/, '');
    } catch { return null; }
  };
  const enabled = (button) => button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  const products = [];
  const seen = new Set();
  for (const card of document.querySelectorAll('.product-card-container')) {
    const title = card.querySelector('[data-test="fop-title"]');
    const link = title?.closest('a') || card.querySelector('[data-test="fop-product-link"][aria-hidden="false"]');
    const url = canonical(link?.getAttribute('href'));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const name = clean(title?.textContent || link?.textContent);
    if (!name) continue;
    const sizeContainer = card.querySelector('[data-test="fop-size"]');
    const size = clean(sizeContainer?.querySelector('span:not(.salt-vc)')?.textContent);
    const buttons = [...card.querySelectorAll('button')];
    const add = buttons.find((button) => /^add\b.*\bto basket$/i.test(button.getAttribute('aria-label') || ''));
    const unavailable = /(out of stock|unavailable|not available)/i.test(clean(card.textContent));
    products.push({ url, name, size, price: clean(card.querySelector('[data-test="fop-price"]')?.textContent),
      unitPrice: clean(card.querySelector('[data-test="fop-price-per-unit"]')?.textContent),
      offer: clean(card.querySelector('[data-test="fop-offer-text"]')?.textContent),
      availability: unavailable ? 'unavailable' : enabled(add) ? 'addable' : 'unknown',
      checkedAt: new Date().toISOString(), canAdd: Boolean(enabled(add) && !unavailable), source: 'current-page' });
  }
  // Product pages may provide richer brand/size data via public structured data.
  const collect = (value) => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object') return;
    if (value['@graph']) collect(value['@graph']);
    if (![value['@type']].flat().includes('Product')) return;
    const url = canonical(value.url || location.href);
    if (!url || seen.has(url) || !value.name) return;
    seen.add(url);
    const offers = [value.offers].flat().filter(Boolean);
    const offer = offers[0];
    products.push({ url, name: clean(String(value.name)), brand: clean(typeof value.brand === 'string' ? value.brand : value.brand?.name),
      size: clean(typeof value.size === 'string' ? value.size : ''),
      price: offer?.priceCurrency === 'GBP' && offer?.price != null ? `£${Number(offer.price).toFixed(2)}` : '',
      availability: /OutOfStock|SoldOut/.test(offer?.availability || '') ? 'unavailable' : 'unknown',
      checkedAt: new Date().toISOString(), canAdd: false, source: 'structured-data' });
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { collect(JSON.parse(script.textContent)); } catch { /* Ignore invalid optional metadata. */ }
  }
  return { url: location.href, checkedAt: new Date().toISOString(), products: products.slice(0, 150) };
}

export function requestAddOnePack(productUrl) {
  if (location.origin !== 'https://groceries.morrisons.com') throw new Error('Open Morrisons first.');
  const canonical = (href) => {
    const url = new URL(href, location.origin);
    return url.origin + url.pathname.replace(/\/$/, '');
  };
  if (!/^https:\/\/groceries\.morrisons\.com\/products\/[a-z0-9-]+\/\d+$/i.test(productUrl)) throw new Error('Invalid Morrisons product.');
  for (const card of document.querySelectorAll('.product-card-container')) {
    const matches = [...card.querySelectorAll('a[href]')].some((link) => canonical(link.getAttribute('href')) === productUrl);
    if (!matches) continue;
    const button = [...card.querySelectorAll('button')].find((candidate) => /^add\b.*\bto basket$/i.test(candidate.getAttribute('aria-label') || ''));
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') throw new Error('Use the product’s own Morrisons control. Its Add button is not currently available to the extension.');
    if (/(out of stock|unavailable|not available)/i.test(card.textContent)) throw new Error('This product is currently shown as unavailable.');
    button.click();
    return { requested: true, message: 'One Add click requested. Check Morrisons for login prompts, quantity and basket confirmation before marking this ingredient done.' };
  }
  throw new Error('This product is no longer on the page. Open its search results and refresh the extension.');
}

// Read the exact product's visible basket counter, using Morrisons' current controls.
export function inspectBasketProduct(productUrl) {
  if (location.origin !== 'https://groceries.morrisons.com') throw new Error('Open Morrisons first.');
  const canonical = (href) => {
    try { const url = new URL(href, location.origin); return url.origin + url.pathname.replace(/\/$/, ''); } catch { return ''; }
  };
  for (const card of document.querySelectorAll('.product-card-container')) {
    if (![...card.querySelectorAll('a[href]')].some((link) => canonical(link.getAttribute('href')) === productUrl)) continue;
    const input = card.querySelector('input[data-test="quantity-in-basket"]');
    const add = card.querySelector('button[data-test="counter-button"][aria-label^="Add "]');
    const increment = card.querySelector('button[data-test="counter:increment"]');
    const button = input ? increment : add;
    const enabled = button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
    const unavailable = /(out of stock|unavailable|not available)/i.test(card.textContent);
    const value = input ? input.value : add ? '0' : '';
    const quantity = /^\d+$/.test(value) ? Number(value) : null;
    return { found: true, quantity, canIncrease: Boolean(enabled && !unavailable), unavailable };
  }
  return { found: false, quantity: null, canIncrease: false };
}

// One click only, followed by a bounded wait for the exact product's counter.
export async function increaseBasketProduct(productUrl, expectedBefore, timeoutMs = 10000) {
  if (location.origin !== 'https://groceries.morrisons.com') throw new Error('Open Morrisons first.');
  if (!/^https:\/\/groceries\.morrisons\.com\/products\/[a-z0-9-]+\/\d+$/i.test(productUrl)) throw new Error('Invalid Morrisons product.');
  const findCard = () => [...document.querySelectorAll('.product-card-container')].find((card) => [...card.querySelectorAll('a[href]')].some((link) => {
    const url = new URL(link.getAttribute('href'), location.origin);
    return url.origin + url.pathname.replace(/\/$/, '') === productUrl;
  }));
  const read = () => {
    const card = findCard();
    const input = card?.querySelector('input[data-test="quantity-in-basket"]');
    const add = card?.querySelector('button[data-test="counter-button"][aria-label^="Add "]');
    const raw = input ? input.value : add ? '0' : '';
    return { card, quantity: /^\d+$/.test(raw) ? Number(raw) : null };
  };
  const initial = read();
  if (!initial.card || initial.quantity !== expectedBefore) return { confirmed: false, quantity: initial.quantity, clicked: false };
  const button = expectedBefore === 0
    ? initial.card.querySelector('button[data-test="counter-button"][aria-label^="Add "]')
    : initial.card.querySelector('button[data-test="counter:increment"]');
  if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[hidden]')) return { confirmed: false, quantity: expectedBefore, clicked: false };
  if (/(out of stock|unavailable|not available)/i.test(initial.card.textContent)) return { confirmed: false, quantity: expectedBefore, clicked: false };
  button.click();
  const deadline = Date.now() + Math.min(timeoutMs, 15000);
  let stableSince = null;
  while (Date.now() < deadline) {
    const current = read();
    if (current.quantity === expectedBefore + 1) {
      stableSince ??= Date.now();
      // Allow optimistic changes to settle before moving on to the next pack.
      if (Date.now() - stableSince >= 1000) return { confirmed: true, quantity: current.quantity, clicked: true };
    } else {
      stableSince = null;
      if (current.quantity != null && current.quantity !== expectedBefore) return { confirmed: false, quantity: current.quantity, clicked: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return { confirmed: false, quantity: read().quantity, clicked: true };
}

// Capture each product as we scroll: virtualised grids may remove earlier cards.
export async function collectMorrisonsResults(targetUrl = null, options = {}) {
  if (location.origin !== 'https://groceries.morrisons.com') throw new Error('Open Morrisons first.');
  const timeout = Math.min(options.timeoutMs ?? 20000, 30000);
  const maxScrolls = Math.min(options.maxScrolls ?? 30, 60);
  const pause = options.pauseMs ?? 400;
  const products = new Map();
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const capture = () => {
    for (const card of document.querySelectorAll('.product-card-container')) {
      const title = card.querySelector('[data-test="fop-title"]');
      const link = title?.closest('a') || card.querySelector('[data-test="fop-product-link"][aria-hidden="false"]');
      let url;
      try { const parsed = new URL(link?.getAttribute('href'), location.origin); if (parsed.origin !== location.origin || !/^\/products\/[a-z0-9-]+\/\d+\/?$/i.test(parsed.pathname)) continue; url = parsed.origin + parsed.pathname.replace(/\/$/, ''); } catch { continue; }
      const name = clean(title?.textContent || link?.textContent); if (!name) continue;
      const add = card.querySelector('button[data-test="counter:increment"]') || [...card.querySelectorAll('button')].find((button) => /^add\b.*\bto basket$/i.test(button.getAttribute('aria-label') || ''));
      const unavailable = /(out of stock|unavailable|not available)/i.test(card.textContent);
      const enabled = add && !add.disabled && add.getAttribute('aria-disabled') !== 'true';
      products.set(url, { url, name, size: clean(card.querySelector('[data-test="fop-size"] span:not(.salt-vc)')?.textContent),
        price: clean(card.querySelector('[data-test="fop-price"]')?.textContent),
        offer: clean(card.querySelector('[data-test="fop-offer-text"]')?.textContent),
        canAdd: Boolean(enabled && !unavailable), availability: unavailable ? 'unavailable' : enabled ? 'addable' : 'unknown',
        checkedAt: new Date().toISOString(), source: 'scrolled-page' });
    }
  };
  const deadline = Date.now() + timeout;
  const originalY = window.scrollY;
  window.scrollTo(0, 0);
  await new Promise((resolve) => setTimeout(resolve, pause));
  let quietAtBottom = 0;
  let lastCount = -1;
  let iterations = 0;
  for (; iterations < maxScrolls && Date.now() < deadline; iterations++) {
    capture();
    if (targetUrl && products.has(targetUrl)) {
      // Leave the target mounted for quantity checks and Add actions.
      return { url: location.href, products: [...products.values()], checkedAt: new Date().toISOString(), targetFound: true, truncated: false };
    }
    const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    const bottom = window.scrollY + window.innerHeight >= height - 40;
    if (bottom) {
      const more = [...document.querySelectorAll('button')].find((button) => /^(load more|show more|show more products|load more products)$/i.test(clean(button.textContent)) && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
      if (more) { more.click(); quietAtBottom = 0; }
      else quietAtBottom = products.size === lastCount ? quietAtBottom + 1 : 0;
      if (quietAtBottom >= 3) break;
    }
    lastCount = products.size;
    window.scrollBy(0, Math.max(300, Math.floor(window.innerHeight * 0.75)));
    await new Promise((resolve) => setTimeout(resolve, pause));
  }
  capture();
  if (!targetUrl) window.scrollTo(0, originalY);
  return { url: location.href, products: [...products.values()], checkedAt: new Date().toISOString(), targetFound: targetUrl ? products.has(targetUrl) : undefined, truncated: iterations >= maxScrolls || Date.now() >= deadline };
}
