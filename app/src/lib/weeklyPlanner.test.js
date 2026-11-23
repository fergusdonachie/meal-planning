import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentWeek, shiftWeek, suggestMeals, validWeek, weekLabel } from './weeklyMenu.js';
import { restorePlanner, serializePlanner, updatePlanner } from './weeklyPlanner.js';
const recipes = JSON.parse(readFileSync(new URL('../../../data/recipes.json', import.meta.url)));

test('weeks start Monday in London, including Sunday UTC during British Summer Time', () => {
  assert.equal(currentWeek(new Date('2026-11-23T12:00:00Z')), '2026-11-23');
  assert.equal(currentWeek(new Date('2026-11-22T23:59:00Z')), '2026-11-16');
  assert.equal(currentWeek(new Date('2026-07-05T23:30:00Z')), '2026-07-06');
  assert.equal(shiftWeek('2026-12-28', 1), '2027-01-04');
  assert.equal(validWeek('2026-11-24'), false);
  assert.equal(validWeek('2026-02-30'), false);
  assert.equal(weekLabel('2026-11-23'), '23 Nov – 29 Nov 2026');
});

test('suggestions give four or five unique meals, mixed cuisines and the planned proteins', () => {
  for (const count of [4, 5]) {
    const ids = suggestMeals(recipes, '2026-11-23', count);
    const meals = ids.map((id) => recipes.find((recipe) => recipe.id === id));
    assert.equal(ids.length, count);
    assert.equal(new Set(ids).size, count);
    assert.equal(meals.filter((recipe) => recipe.fish).length, 2);
    assert.ok(meals.some((recipe) => recipe.protein === 'Vegetarian'));
    assert.ok(meals.some((recipe) => recipe.protein === 'Chicken'));
    assert.ok(new Set(meals.map((recipe) => recipe.cuisine)).size >= 3);
    assert.deepEqual(suggestMeals(recipes, '2026-11-23', count), ids);
    assert.deepEqual(suggestMeals([...recipes].reverse(), '2026-11-23', count), ids);
  }
});

test('suggestions rotate across weeks and avoid the previous menu when alternatives exist', () => {
  const previous = suggestMeals(recipes, '2026-11-16');
  const next = suggestMeals(recipes, '2026-11-23', 5, previous);
  assert.ok(next.every((id) => !previous.includes(id)));
  const variants = Array.from({ length: 5 }, (_, i) => suggestMeals(recipes, '2026-11-23', 5, [], i).join(','));
  assert.ok(new Set(variants).size > 1);
  assert.deepEqual(suggestMeals([], '2026-11-23'), []);
  assert.equal(suggestMeals(recipes.slice(0, 2), '2026-11-23').length, 2);
});

test('legacy menus migrate once, then a new calendar week starts empty without losing history', () => {
  const planner = restorePlanner(null, { selected: ['fish'], completed: ['fish'] }, '2026-11-16');
  const saved = serializePlanner(planner);
  const next = restorePlanner(saved, { selected: ['stale'] }, '2026-11-23');
  assert.equal(next.week, '2026-11-23');
  assert.equal(next.weeks['2026-11-23'], undefined);
  assert.deepEqual([...next.weeks['2026-11-16'].completed], ['fish']);
});

test('swapping keeps slot order, excludes duplicates and protects cooked meals', () => {
  const planner = restorePlanner(null, { selected: ['fish', 'chicken', 'veg'], completed: ['fish'] }, '2026-11-23');
  const swapped = updatePlanner(planner, { type: 'swap', id: 'chicken', replacement: 'beef' });
  assert.deepEqual([...swapped.weeks[swapped.week].selected], ['fish', 'beef', 'veg']);
  assert.equal(updatePlanner(planner, { type: 'swap', id: 'chicken', replacement: 'veg' }), planner);
  assert.equal(updatePlanner(planner, { type: 'swap', id: 'fish', replacement: 'beef' }), planner);
});

test('clearing and replacing affect only the chosen week and never mutate a previous menu', () => {
  const first = restorePlanner(null, { selected: ['fish'], completed: ['fish'] }, '2026-11-16');
  const next = updatePlanner(first, { type: 'week', week: '2026-11-23' });
  const planned = updatePlanner(next, { type: 'replace', ids: ['chicken', 'veg'] });
  const cleared = updatePlanner(planned, { type: 'clear' });
  assert.deepEqual([...cleared.weeks['2026-11-16'].completed], ['fish']);
  assert.equal(cleared.weeks['2026-11-23'].selected.size, 0);
  assert.equal(planned.weeks['2026-11-23'].selected.size, 2);
  assert.equal(updatePlanner(first, { type: 'week', week: '__proto__' }), first);
});
