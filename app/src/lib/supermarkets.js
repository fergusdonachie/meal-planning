import { parseIngredient } from './shoppingList.js';

export const STORE_KEY = 'weeklyTableSupermarket';
export const SUPERMARKETS = [
  { id: 'tesco', name: 'Tesco', home: 'https://www.tesco.com/groceries/', search: 'https://www.tesco.com/shop/en-GB/search', parameter: 'query' },
  { id: 'morrisons', name: 'Morrisons', home: 'https://groceries.morrisons.com/', search: 'https://groceries.morrisons.com/search', parameter: 'q' },
  { id: 'sainsburys', name: 'Sainsbury’s', home: 'https://www.sainsburys.co.uk/groceries/', search: 'https://www.sainsburys.co.uk/groceries/search', parameter: 'searchTerm' },
];

export function getSupermarket(id) {
  return SUPERMARKETS.find((store) => store.id === id) || SUPERMARKETS[0];
}

export function ingredientSearchTerm(ingredient) {
  return parseIngredient(ingredient)?.name || ingredient.split(',')[0].trim();
}

export function supermarketSearchUrl(storeId, query) {
  const store = getSupermarket(storeId);
  if (!query.trim()) return store.home;
  const url = new URL(store.search);
  url.searchParams.set(store.parameter, query.trim());
  return url.href;
}
