import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPERMARKETS, getSupermarket, ingredientSearchTerm, supermarketSearchUrl } from './supermarkets.js';
import { prepareShoppingList } from './shoppingList.js';

test('search terms remove quantities and preparation but preserve varieties', () => {
  assert.equal(ingredientSearchTerm('300g chicken breast, sliced'), 'chicken breast');
  assert.equal(ingredientSearchTerm('1 x 400g tin black beans, drained'), 'black beans');
  assert.equal(ingredientSearchTerm('120g brown rice'), 'brown rice');
  assert.equal(ingredientSearchTerm('1 lemon or lime'), '1 lemon or lime');
});

test('each retailer receives an encoded query on its own search page', () => {
  for (const store of SUPERMARKETS) {
    const url = new URL(supermarketSearchUrl(store.id, '  M&S peas / beans?  '));
    assert.equal(url.origin, new URL(store.home).origin);
    assert.equal(url.searchParams.get(store.parameter), 'M&S peas / beans?');
    assert.equal(url.searchParams.size, 1);
    assert.equal(supermarketSearchUrl(store.id, '  '), store.home);
  }
});

test('missing or unavailable stores fall back to Tesco and existing choices are kept', () => {
  assert.equal(getSupermarket('unknown').id, 'tesco');
  assert.equal(getSupermarket(null).id, 'tesco');
  assert.equal(getSupermarket('ocado').id, 'tesco');
  assert.equal(getSupermarket('morrisons').id, 'morrisons');
  assert.equal(getSupermarket('sainsburys').id, 'sainsburys');
});

test('shopping searches use the remaining combined quantities after pantry exclusions', () => {
  const recipes = [
    { id: 'a', title: 'A', ingredients: ['100g brown rice', '1 lemon'] },
    { id: 'b', title: 'B', ingredients: ['120g brown rice'] },
  ];
  const { combined, text } = prepareShoppingList(recipes, new Set(['a', 'b']), new Set(['a:1 lemon', 'a:100g brown rice']));
  assert.deepEqual(combined.map((entry) => entry.label), ['120g brown rice']);
  assert.equal(new URL(supermarketSearchUrl('tesco', ingredientSearchTerm(combined[0].name))).searchParams.get('query'), 'brown rice');
  assert.doesNotMatch(text, /Morrisons/);
});
