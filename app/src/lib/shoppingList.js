import { groupShoppingSections } from './shoppingSections.js';

export function ingredientKey(recipe, ingredient) {
  return `${recipe.id}:${ingredient}`;
}

const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' };
const AMOUNT = '(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)';
const SINGULAR = {
  'garlic cloves': 'garlic clove', lemons: 'lemon', limes: 'lime', onions: 'onion',
  'red onions': 'red onion', 'spring onions': 'spring onion', shallots: 'shallot',
  'red peppers': 'red pepper', 'yellow peppers': 'yellow pepper',
  'red chillies': 'red chilli', chillies: 'chilli', eggs: 'egg', tomatoes: 'tomato',
  carrots: 'carrot', courgettes: 'courgette', 'lemongrass stalks': 'lemongrass stalk',
};
const ALIASES = {
  'garlic clove': 'garlic cloves', 'garlic cloves': 'garlic cloves',
  lemon: 'lemons', lemons: 'lemons', lime: 'limes', limes: 'limes',
  onion: 'onions', onions: 'onions', 'red onion': 'red onions', 'red onions': 'red onions',
  'spring onion': 'spring onions', 'spring onions': 'spring onions', shallot: 'shallots', shallots: 'shallots',
  'red pepper': 'red peppers', 'red peppers': 'red peppers', 'yellow pepper': 'yellow peppers', 'yellow peppers': 'yellow peppers',
  'red chilli': 'red chillies', 'red chillies': 'red chillies', 'fresh red chilli': 'red chillies', 'fresh chilli': 'chillies',
  egg: 'eggs', eggs: 'eggs', tomato: 'tomatoes', tomatoes: 'tomatoes', carrot: 'carrots', carrots: 'carrots',
  cucumber: 'cucumber', courgette: 'courgettes', courgettes: 'courgettes', avocado: 'avocado',
  'lemongrass stalk': 'lemongrass stalks', 'lemongrass stalks': 'lemongrass stalks',
  'plain greek yoghurt': 'Greek yoghurt', 'greek yoghurt': 'Greek yoghurt',
  parsley: 'fresh parsley', 'fresh parsley': 'fresh parsley', 'flat-leaf parsley': 'fresh parsley',
  coriander: 'fresh coriander', 'fresh coriander': 'fresh coriander', dill: 'fresh dill', 'fresh dill': 'fresh dill',
  ginger: 'fresh ginger', 'fresh ginger': 'fresh ginger',
  'ground cumin': 'ground cumin', cumin: 'ground cumin', turmeric: 'ground turmeric',
  'traditionally brewed soy sauce': 'traditionally brewed soy sauce',
};

function number(value) {
  return value.split(/\s+/).reduce((sum, part) => {
    const [top, bottom] = part.split('/').map(Number);
    return sum + (bottom ? top / bottom : top);
  }, 0);
}

function normaliseName(name) {
  const lower = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[lower] || lower;
}

// Preserve alternatives and ranges rather than choosing ingredients for the shopper.
export function parseIngredient(original) {
  const cleaned = original.replace(/\((?:coconut and water only|fish and salt only|soya beans, water and coagulant)\)/gi, '').trim();
  const safe = cleaned.split(/,\s*/)[0].trim();
  if (/\bor\b|\d\s*[-–]\s*\d|\(or\b/i.test(original)) return null;
  let value = safe.replace(/(\d)([½¼¾⅓⅔⅛])/g, '$1 $2');
  value = value.replace(/[½¼¾⅓⅔⅛]/g, (fraction) => FRACTIONS[fraction]);
  // Parenthetical label guidance isn't an ingredient; amounts/alternatives remain opaque.
  value = value.replace(/\((?:coconut and water only|fish and salt only|soya beans, water and coagulant)\)/gi, '').trim();
  if (/[()]/.test(value)) return null;
  let match = value.match(new RegExp(`^(${AMOUNT})\\s*x\\s*(${AMOUNT})\\s*(g|ml)\\s+tin\\s+(.+)$`, 'i'));
  if (match) return { name: normaliseName(match[4]), unit: `tin:${number(match[2])}:${match[3].toLowerCase()}`, quantity: number(match[1]) };
  match = value.match(new RegExp(`^(${AMOUNT})\\s*(kg|g|ml|l|tbsp|tsp|cm)\\s+(.+)$`, 'i'));
  if (match) {
    const unit = match[2].toLowerCase();
    const factor = { kg: 1000, l: 1000, tbsp: 3 }[unit] || 1;
    return { name: normaliseName(unit === 'tsp' || unit === 'tbsp' ? match[3].replace(/^coriander$/i, 'ground coriander') : match[3]), unit: { kg: 'g', l: 'ml', tbsp: 'tsp' }[unit] || unit, quantity: number(match[1]) * factor };
  }
  match = value.match(/^(small handful|small bunch|bunch|pinch)\s+(.+)$/i);
  if (match) return { name: normaliseName(match[2]), unit: match[1].toLowerCase(), quantity: 1 };
  match = value.match(new RegExp(`^(${AMOUNT})\\s+(.+)$`, 'i'));
  if (match) return { name: normaliseName(match[2]), unit: 'count', quantity: number(match[1]) };
  return null;
}

function formatNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function formatAmount(quantity, unit) {
  if (unit.startsWith('tin:')) {
    const [, size, measure] = unit.split(':');
    return `${formatNumber(quantity)} × ${size}${measure} tin${quantity === 1 ? '' : 's'}`;
  }
  if (unit === 'count') return formatNumber(quantity);
  if (unit === 'g' || unit === 'ml' || unit === 'cm') return `${formatNumber(quantity)}${unit}`;
  if (unit === 'tsp') {
    if (quantity >= 3 && Number.isInteger(quantity / 3)) return `${formatNumber(quantity / 3)} tbsp`;
    return `${formatNumber(quantity)} tsp`;
  }
  const plurals = { pinch: 'pinches', bunch: 'bunches', 'small bunch': 'small bunches', 'small handful': 'small handfuls' };
  return `${formatNumber(quantity)} ${quantity === 1 ? unit : plurals[unit] || unit}`;
}

export function combineIngredients(items) {
  const groups = new Map();
  for (const recipe of items) {
    for (const ingredient of recipe.ingredients) {
      const parsed = parseIngredient(ingredient);
      const key = parsed ? `ingredient:${parsed.name}` : `review:${ingredient.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { key, name: parsed?.name || ingredient, amounts: new Map(), sources: [], review: !parsed });
      const group = groups.get(key);
      if (parsed) group.amounts.set(parsed.unit, (group.amounts.get(parsed.unit) || 0) + parsed.quantity);
      group.sources.push({ recipeId: recipe.id, recipeTitle: recipe.title, ingredient, key: ingredientKey(recipe, ingredient) });
    }
  }
  return [...groups.values()].map((group) => {
    const amounts = [...group.amounts].map(([unit, quantity]) => formatAmount(quantity, unit)).join(' + ');
    const name = group.amounts.size === 1 && group.amounts.has('count') && group.amounts.get('count') <= 1
      ? SINGULAR[group.name] || group.name : group.name;
    // Repeated opaque entries retain every required quantity explicitly.
    const label = group.review
      ? `${group.sources.length > 1 && /[0-9½¼¾⅓⅔⅛]/.test(group.name) ? `${group.sources.length} × (${group.name})` : group.name}`
      : `${amounts} ${name}`;
    return { ...group, label };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function prepareShoppingList(recipes, selected, excluded = new Set(), view = 'combined') {
  const items = [...selected].map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean);
  const needed = items.map((recipe) => ({ ...recipe, ingredients: recipe.ingredients.filter((ingredient) => !excluded.has(ingredientKey(recipe, ingredient))) }));
  const combined = combineIngredients(needed);
  const allCombined = combineIngredients(items);
  const sections = groupShoppingSections(combined);
  const allSections = groupShoppingSections(allCombined);
  const remaining = needed.reduce((count, recipe) => count + recipe.ingredients.length, 0);
  const lines = view === 'combined'
    ? ['Combined ingredients for the selected recipes, grouped by supermarket section.', 'Different measures are shown together; alternatives and unclear amounts are kept as written.', '',
      ...sections.flatMap((section) => [section.title, ...section.entries.map((entry) => `• ${entry.label}`), ''])]
    : ['Ingredients by recipe.', '', ...needed.filter((recipe) => recipe.ingredients.length).flatMap((recipe) => [
      `${recipe.title} (serves ${recipe.servings})`, ...recipe.ingredients.map((ingredient) => `• ${ingredient}`), '',
    ])];
  return { items, remaining, combined, allCombined, sections, allSections, text: ['The Weekly Table — Morrisons shopping list', ...lines].join('\n') };
}
