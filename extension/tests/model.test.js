import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImport, productUrl, searchUrl, suggestedPacks } from '../model.js';
import { extensionShoppingList } from '../../app/src/lib/extensionExport.js';
import { prepareShoppingList } from '../../app/src/lib/shoppingList.js';

test('the app export imports with its section and combined quantity intact', () => {
  const recipes = [{ id: 'a', ingredients: ['100g basmati rice'] }, { id: 'b', ingredients: ['120g basmati rice'] }];
  const payload = extensionShoppingList(prepareShoppingList(recipes, new Set(['a', 'b'])).sections);
  const imported = validateImport(payload);
  assert.equal(imported.items[0].label, '220g basmati rice');
  assert.equal(imported.items[0].section, 'Rice, pasta & grains');
  assert.equal(suggestedPacks(imported.items[0], '1kg'), 1);
});

test('imports reject duplicate keys, malformed quantities and excessive lists', () => {
  const item = { key: 'rice', name: 'rice', label: '100g rice', amounts: [{ unit: 'g', quantity: 100 }] };
  assert.throws(() => validateImport({ version: 1, items: [item, item] }));
  assert.throws(() => validateImport({ version: 1, items: [{ ...item, amounts: [{ unit: 'g', quantity: -1 }] }] }));
  assert.throws(() => validateImport({ version: 1, items: Array(201).fill(item) }));
});

test('only canonical Morrisons product URLs can be saved or used', () => {
  assert.equal(productUrl('/products/morrisons-rice/104544029?list=search'), 'https://groceries.morrisons.com/products/morrisons-rice/104544029');
  assert.equal(productUrl('https://evil.example/products/rice/123'), null);
  assert.equal(productUrl('javascript:alert(1)'), null);
  assert.equal(productUrl('/checkout'), null);
  assert.equal(new URL(searchUrl('rice & beans')).searchParams.get('q'), 'rice & beans');
});

test('pack suggestions convert weights without inventing volume or multipack conversions', () => {
  const item = { amounts: [{ unit: 'g', quantity: 750 }] };
  assert.equal(suggestedPacks(item, '500g'), 2);
  assert.equal(suggestedPacks(item, '1kg'), 1);
  assert.equal(suggestedPacks(item, '500ml'), null);
  assert.equal(suggestedPacks(item, '2 x 500g'), null);
  assert.equal(suggestedPacks({ amounts: [{ unit: 'count', quantity: 2 }] }, '500g'), null);
});
