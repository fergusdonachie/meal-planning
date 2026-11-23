import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesCookingMethod } from './recipeFilters.js';
import { suggestMeals } from './weeklyMenu.js';
const recipes = JSON.parse(readFileSync(new URL('../../../data/recipes.json', import.meta.url)));
test('single-vessel filter uses reviewed cooking metadata rather than misleading tags', () => {
  assert.equal(matchesCookingMethod({ tags: ['One-pan'] }, 'single'), false);
  assert.equal(matchesCookingMethod({ cookingMethod: 'One pot' }, 'single'), true);
  assert.equal(matchesCookingMethod({ cookingMethod: 'One tray' }, 'One pot'), false);
  assert.equal(matchesCookingMethod({}, ''), true);
  assert.equal(matchesCookingMethod(recipes.find((r) => r.id === 'med-veg-halloumi-bowl'), 'single'), false);
});
test('one-vessel weekly suggestions have five unique meals and every recipe has a complete card and image', () => {
  const pool = recipes.filter((r) => matchesCookingMethod(r, 'single'));
  const ids = suggestMeals(pool, '2026-11-23', 5);
  assert.equal(ids.length, 5);
  assert.equal(new Set(ids).size, 5);
  for (const id of ids) assert.equal(pool.some((r) => r.id === id), true);
  for (const id of ['med-salmon-potato-tray', 'med-chicken-orzo-pot', 'per-chickpea-spinach-rice']) {
    const r = recipes.find((r) => r.id === id);
    assert.equal(matchesCookingMethod(r, 'single'), true);
    assert.ok(r.ingredients.length && r.method.length && r.imageSource === 'ai');
    assert.ok(readFileSync(new URL('../../../' + r.image, import.meta.url)).length > 1000);
  }
});
