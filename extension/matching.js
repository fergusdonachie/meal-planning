import { ingredientQuery, productUrl } from './model.js';

function words(value) {
  return value.toLowerCase().replace(/chick\s*peas/g, 'chickpeas').replace(/chili(?:es)?/g, 'chilli').replace(/yogurt/g, 'yoghurt')
    .replace(/\bminced\b/g, 'mince').replace(/\bpotatoes\b/g, 'potato').replace(/\btomatoes\b/g, 'tomato')
    .replace(/\bchillies\b/g, 'chilli').replace(/\bbreasts\b/g, 'breast').replace(/\bthighs\b/g, 'thigh')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
}
const IGNORE = new Set(['fresh', 'good', 'quality', 'plain', 'firm', 'lean', 'small', 'large', 'whole', 'peeled', 'raw', 'unsalted', 'traditionally', 'brewed', 'clove', 'cloves', 'stalk', 'stalks', 'fillet', 'fillets', 'leaves', 'ground']);
const singular = (word) => ({ eggs: 'egg', onions: 'onion', peppers: 'pepper', carrots: 'carrot', lemons: 'lemon', limes: 'lime', beans: 'bean', shallots: 'shallot' }[word] || word);

export function packQuantity(item, product) {
  const size = product.size.trim().toLowerCase();
  const mass = size.match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|l)$/);
  const count = size.match(/^(\d+)\s*(?:per pack|pack|pk|pieces|each)$/) || (/^(each|single)$/.test(size) ? ['each', '1'] : null);
  const unitSize = mass ? Number(mass[2]) * (Number(mass[1]) || 1) * (/^(kg|l)$/.test(mass[3]) ? 1000 : 1) : null;
  const base = mass ? /g$/.test(mass[3]) ? 'g' : 'ml' : 'count';
  let required = 0;
  for (const amount of item.amounts || []) {
    if (amount.unit === base) required += amount.quantity;
    else if (base === 'ml' && amount.unit === 'tsp') required += amount.quantity * 5;
    else if (base === 'ml' && amount.unit === 'tbsp') required += amount.quantity * 15;
    else if (mass && amount.unit.startsWith('tin:')) {
      const [, labelledSize, unit] = amount.unit.split(':');
      if (unit !== base) return { packs: 1, estimated: true, reason: 'Check the pack count: ingredient and product measures differ.' };
      required += amount.quantity * Number(labelledSize);
    } else return { packs: 1, estimated: true, reason: 'One pack proposed; the recipe measure cannot be converted reliably.' };
  }
  if (!required) return { packs: 1, estimated: true, reason: 'One pack proposed; the recipe does not give a measurable amount.' };
  const divisor = unitSize || (count ? Number(count[1]) : null);
  if (!divisor) return { packs: 1, estimated: true, reason: 'One pack proposed; the pack quantity needs checking.' };
  return { packs: Math.max(1, Math.ceil(required / divisor)), estimated: false, reason: 'Pack count calculated from the combined recipe quantity.' };
}

export function rankProducts(item, products, preferred) {
  const query = ingredientQuery(item).split(/\bor\b/i)[0];
  const required = words(query).map(singular).filter((word) => word && !IGNORE.has(word));
  if (!required.length) return [];
  return products.flatMap((product) => {
    if (!productUrl(product.url) || !product.canAdd || product.availability === 'unavailable') return [];
    const title = product.name.toLowerCase();
    const titleWords = new Set(words(product.name).map(singular));
    if (!required.every((word) => titleWords.has(word))) return [];
    // Preserve from-scratch ingredient intent; don't replace rice/chicken/aromatics with ready dishes.
    if (!/\b(sauce|paste|stock|curry|chips|cooked)\b/i.test(query) && /\b(sauce|paste|microwave|ready meal|ready to eat|coated|breaded|seasoned|marinated|flavoured|flavored|spiced|kebab|burger|nugget|cooked)\b/i.test(title)) return [];
    if (!/\b(juice|drink|tea|biscuits?|cake|crisps?|snack|pesto|seasoning)\b/i.test(query) && /\b(juice|drink|tea|biscuits?|cake|crisps?|snack|pesto|seasoning)\b/i.test(title)) return [];
    if (/\bunsalted\b/i.test(query) && /\bsalted\b/i.test(title)) return [];
    if (/\bcooked\b/i.test(query) && !/\bcooked\b/i.test(title)) return [];
    if (/\braw\b/i.test(query) && /\bcooked\b/i.test(title)) return [];
    if (/\b(fresh|leaves)\b/i.test(query) && /\b(dried|ground|powder|frozen)\b/i.test(title)) return [];
    if (/\bground\b/i.test(query) && !/\b(ground|powder)\b/i.test(title)) return [];
    if (/\btin:/.test(JSON.stringify(item.amounts)) && /\b(dried|dry|uncooked)\b/i.test(title)) return [];
    const quantity = packQuantity(item, product);
    if (quantity.packs > 20) return [];
    const price = Number(product.price.replace(/[^\d.]/g, ''));
    const total = price > 0 ? price * quantity.packs : Infinity;
    const saved = preferred?.url === product.url;
    return [{ ...product, ...quantity, total, score: (saved ? 10000 : 0) + (quantity.estimated ? 0 : 1000) + (title.startsWith('morrisons ') ? 5 : 0) - Math.min(total, 999) }];
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export async function matchShoppingList(items, preferences, adapter, shouldStop = () => false) {
  const results = [];
  for (const item of items) {
    if (shouldStop()) break;
    await adapter.progress(item, results.length, items.length);
    try {
      const page = await adapter.search(item, ingredientQuery(item).split(/\bor\b/i)[0].trim());
      const candidates = rankProducts(item, page.products, preferences[item.key]);
      results.push({ item, candidates: candidates.slice(0, 8), selected: candidates[0]?.url || null, target: candidates[0]?.packs || null,
        note: candidates[0]?.reason || 'No suitable product found. Choose a product manually or adjust the search.', truncated: Boolean(page.truncated) });
    } catch (error) { results.push({ item, candidates: [], selected: null, target: null, note: error.message }); }
  }
  return results;
}

export function proposalRows(proposals) {
  const groups = new Map();
  for (const proposal of proposals) {
    const product = proposal.candidates.find((candidate) => candidate.url === proposal.selected);
    if (!product) continue;
    if (!groups.has(product.url)) groups.set(product.url, { url: product.url, name: product.name, size: product.size, ingredients: [], target: 0, amounts: [], automatic: true, product });
    const row = groups.get(product.url);
    row.ingredients.push({ key: proposal.item.key, label: proposal.item.label }); row.target += proposal.target || 0;
    row.amounts.push(...proposal.item.amounts);
    if (proposal.quantityEdited || product.estimated) row.automatic = false;
  }
  return [...groups.values()].map((row) => {
    const quantity = packQuantity({ amounts: row.amounts }, row.product);
    if (row.automatic && !quantity.estimated) row.target = quantity.packs;
    return { url: row.url, name: row.name, size: row.size, ingredients: row.ingredients, target: row.target };
  });
}
