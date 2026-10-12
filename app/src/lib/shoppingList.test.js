import test from 'node:test';
import assert from 'node:assert/strict';
import { ingredientKey, prepareShoppingList } from './shoppingList.js';

const recipes = [
  { id: 'curry', title: 'Fresh curry', servings: 2, ingredients: ['1 lemongrass stalk', '120g rice'] },
  { id: 'fish', title: 'Lemon fish', servings: 4, ingredients: ['2 lemons', '120g rice'] },
];

test('exports only selected meals and ignores stale saved recipe IDs', () => {
  const result = prepareShoppingList(recipes, new Set(['missing', 'fish']), new Set(), 'recipes');
  assert.equal(result.remaining, 2);
  assert.match(result.text, /Lemon fish \(serves 4\)/);
  assert.doesNotMatch(result.text, /Fresh curry/);
});

test('pantry exclusions remove the right ingredient without changing another recipe', () => {
  const excluded = new Set([ingredientKey(recipes[0], '120g rice')]);
  const result = prepareShoppingList(recipes, new Set(['curry', 'fish']), excluded);
  assert.equal(result.remaining, 3);
  assert.equal(result.text.match(/120g rice/g).length, 1);
  assert.match(result.text, /lemongrass/);
  assert.deepEqual(recipes[0].ingredients, ['1 lemongrass stalk', '120g rice']);
});

test('fully excluded dishes are omitted from the handoff text', () => {
  const excluded = new Set(recipes[0].ingredients.map((ingredient) => ingredientKey(recipes[0], ingredient)));
  const result = prepareShoppingList(recipes, new Set(['curry']), excluded);
  assert.equal(result.remaining, 0);
  assert.doesNotMatch(result.text, /Fresh curry/);
});

test('repeated ingredients are added once with the total quantity in the combined export', () => {
  const result = prepareShoppingList(recipes, new Set(['curry', 'fish']));
  assert.equal(result.remaining, 4);
  assert.equal(result.text.match(/240g rice/g).length, 1);
  assert.equal(result.combined.length, 3);
});


function combinedLabels(ingredients) {
  return prepareShoppingList([{ id: 'meal', title: 'Meal', servings: 2, ingredients }], new Set(['meal'])).combined.map((entry) => entry.label);
}

test('fractions, Unicode mixed numbers and preparation descriptions combine', () => {
  assert.deepEqual(combinedLabels(['1/2 red onion, diced', '1½ red onions, sliced', '1 red onion, wedged']), ['3 red onions']);
  assert.deepEqual(combinedLabels(['1 garlic clove, grated', '2 garlic cloves, sliced']), ['3 garlic cloves']);
});

test('compatible metric and spoon units convert before summing', () => {
  assert.deepEqual(combinedLabels(['500g rice', '1/2 kg rice']), ['1000g rice']);
  assert.deepEqual(combinedLabels(['200ml coconut milk', '0.5 l coconut milk']), ['700ml coconut milk']);
  assert.deepEqual(combinedLabels(['1 tbsp olive oil', '1½ tsp olive oil']), ['4.5 tsp olive oil']);
});

test('tins sum at the same labelled size without confusing drained and total weight', () => {
  assert.deepEqual(combinedLabels(['1/2 x 400g tin chickpeas, drained', '1 x 400g tin chickpeas, drained']), ['1.5 × 400g tins chickpeas']);
  assert.deepEqual(combinedLabels(['1 x 400g tin chickpeas', '80g chickpeas']), ['1 × 400g tin + 80g chickpeas']);
});

test('different measures remain explicit and rice varieties stay separate', () => {
  assert.deepEqual(combinedLabels(['10g fresh parsley, chopped', 'Bunch parsley']), ['10g + 1 bunch fresh parsley']);
  assert.equal(combinedLabels(['100g basmati rice', '120g jasmine rice']).length, 2);
});

test('ranges and alternatives retain their original quantities', () => {
  const labels = combinedLabels(['1–2 green chillies, deseeded', '1–2 green chillies, deseeded', '1 tbsp lemon or lime juice']);
  assert.ok(labels.includes('2 × (1–2 green chillies, deseeded)'));
  assert.ok(labels.includes('1 tbsp lemon or lime juice'));
});

test('unmeasured herbs stay readable and ground coriander is separate from fresh leaves', () => {
  assert.deepEqual(combinedLabels(['Coriander', 'Coriander']), ['Coriander']);
  assert.equal(combinedLabels(['1 tsp coriander', '10g fresh coriander']).length, 2);
});

test('plain tofu label guidance does not prevent combining', () => {
  assert.deepEqual(combinedLabels(['250g firm tofu, cubed', '280g firm tofu (soya beans, water and coagulant), drained']), ['530g firm tofu']);
});

test('the full combined list retains sources so pantry toggles can exclude all contributors', () => {
  const result = prepareShoppingList(recipes, new Set(['curry', 'fish']), new Set(['curry:120g rice']));
  assert.equal(result.allCombined.find((entry) => entry.name === 'rice').sources.length, 2);
  assert.equal(result.combined.find((entry) => entry.name === 'rice').label, '120g rice');
});
