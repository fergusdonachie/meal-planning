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
