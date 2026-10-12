import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareShoppingList } from './shoppingList.js';

function list(ingredients, excluded = new Set()) {
  return prepareShoppingList([{ id: 'meal', title: 'Dinner', servings: 2, ingredients }], new Set(['meal']), excluded);
}

test('supermarket sections put vegetables together and keep meat and fish separate', () => {
  const result = list(['200g chicken breast', '1 carrot', '100g salmon', '2 red peppers', '3 eggs', '100g rice']);
  assert.deepEqual(result.sections.map((section) => section.id), ['produce', 'meat', 'fish', 'dairy', 'grains']);
  assert.equal(result.sections[0].entries.length, 2);
  assert.equal(result.sections.flatMap((section) => section.entries).length, result.combined.length);
});

test('preserved ingredients, sauces and dry spices do not end up in fresh aisles', () => {
  const result = list(['1 tbsp fish sauce', '200ml coconut milk', '1 x 160g tin tuna', '1 tsp ground coriander', '10g fresh coriander', '1 tbsp garlic oil', '75g Kalamata olives']);
  const sectionOf = (fragment) => result.sections.find((section) => section.entries.some((entry) => entry.label.includes(fragment)))?.id;
  assert.equal(sectionOf('fish sauce'), 'condiments');
  assert.equal(sectionOf('coconut milk'), 'tins');
  assert.equal(sectionOf('tuna'), 'tins');
  assert.equal(sectionOf('ground coriander'), 'spices');
  assert.equal(sectionOf('fresh coriander'), 'produce');
  assert.equal(sectionOf('garlic oil'), 'condiments');
  assert.equal(sectionOf('olives'), 'tins');
});

test('pantry exclusions omit empty sections from exports while keeping them available to restore', () => {
  const result = list(['250g chicken breast', '1 carrot'], new Set(['meal:250g chicken breast']));
  assert.deepEqual(result.sections.map((section) => section.id), ['produce']);
  assert.deepEqual(result.allSections.map((section) => section.id), ['produce', 'meat']);
  assert.doesNotMatch(result.text, /Meat & poultry/);
  assert.match(result.text, /Fruit, vegetables & fresh herbs\n• 1 carrot/);
});

test('copy/share text follows section order and gives unknown ingredients a visible home', () => {
  const result = list(['250g chicken breast', '1 carrot', '1 unusual ingredient']);
  assert.ok(result.text.indexOf('Fruit, vegetables & fresh herbs') < result.text.indexOf('Meat & poultry'));
  assert.match(result.text, /Other ingredients\n• 1 unusual ingredient/);
});

test('frozen food, bakery, tofu and snacks retain their own sections', () => {
  const result = list(['150g frozen sweetcorn', '250g firm tofu', '2 wholemeal pittas', '40g tortilla chips']);
  assert.deepEqual(result.sections.map((section) => section.id), ['chilled', 'bakery', 'frozen', 'snacks']);
});
