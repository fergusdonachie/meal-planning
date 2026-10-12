export const MORRISONS_ORIGIN = 'https://groceries.morrisons.com';
export const APP_ORIGIN = 'https://fd-meal-planner.vercel.app';

export function validateImport(payload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.items) || payload.items.length > 200) throw new Error('Choose a Weekly Table shopping-list export with up to 200 ingredients.');
  const string = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
  const keys = new Set();
  const items = payload.items.map((item) => {
    if (!string(item.key, 700) || keys.has(item.key) || !string(item.label, 700) || !string(item.name, 500)) throw new Error('The shopping list contains an invalid ingredient.');
    keys.add(item.key);
    const amounts = Array.isArray(item.amounts) ? item.amounts : [];
    if (amounts.length > 20 || amounts.some((amount) => !string(amount.unit, 60) || !Number.isFinite(amount.quantity) || amount.quantity <= 0 || amount.quantity > 1e6)) throw new Error('An ingredient quantity is invalid.');
    return { key: item.key, name: item.name, label: item.label, section: string(item.section, 100) ? item.section : 'Other ingredients', amounts: amounts.map(({unit, quantity}) => ({unit, quantity})) };
  });
  return { version: 1, importedAt: new Date().toISOString(), items };
}

export function productUrl(value) {
  try {
    const url = new URL(value, MORRISONS_ORIGIN);
    if (url.origin !== MORRISONS_ORIGIN || !/^\/products\/[a-z0-9-]+\/\d+\/?$/i.test(url.pathname)) return null;
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch { return null; }
}

export function searchUrl(query) {
  const url = new URL('/search', MORRISONS_ORIGIN);
  url.searchParams.set('q', query.trim().slice(0, 300));
  return url.href;
}

export function ingredientQuery(item) {
  return item.name.split(',')[0].replace(/\([^)]*\)/g, '').replace(/^[\d\s./½¼¾–-]+(?:kg|g|ml|tsp|tbsp)?\s*/i, '').trim().slice(0, 300);
}

export function suggestedPacks(item, packSize) {
  if (!item.amounts?.length || /\d\s*[x×]\s*\d/i.test(packSize)) return null;
  const match = packSize.match(/^\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\s*$/i);
  if (!match) return null;
  const unit = match[2].toLowerCase();
  const base = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit;
  if (item.amounts.some((amount) => amount.unit !== base)) return null;
  const total = item.amounts.reduce((sum, amount) => sum + amount.quantity, 0);
  const pack = Number(match[1]) * (unit === 'kg' || unit === 'l' ? 1000 : 1);
  return pack > 0 ? Math.ceil(total / pack) : null;
}
