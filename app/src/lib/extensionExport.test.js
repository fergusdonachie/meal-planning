import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionShoppingList } from './extensionExport.js';
import { prepareShoppingList } from './shoppingList.js';

test('extension exports combined totals and sections, excluding pantry items', () => {
  const recipes = [
    { id: 'a', ingredients: ['100g rice', '2 lemons'] },
    { id: 'b', ingredients: ['120g rice', '1 carrot'] },
  ];
  const result = prepareShoppingList(recipes, new Set(['a', 'b']), new Set(['a:2 lemons']));
  const exported = extensionShoppingList(result.sections);
  assert.equal(exported.items.length, 2);
  assert.deepEqual(exported.items.find((item) => item.name === 'rice').amounts, [{ unit: 'g', quantity: 220 }]);
  assert.equal(exported.items[0].section, 'Fruit, vegetables & fresh herbs');
  assert.doesNotMatch(JSON.stringify(exported), /lemons|recipeId|session|password/);
});
