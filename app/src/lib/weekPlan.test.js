import test from 'node:test';
import assert from 'node:assert/strict';
import { restorePlan, updatePlan } from './weekPlan.js';

test('existing shopping selections migrate into a weekly plan', () => {
  const plan = restorePlan(null, ['fish', 'curry']);
  assert.deepEqual([...plan.selected], ['fish', 'curry']);
  assert.equal(plan.completed.size, 0);
});

test('cooked meals persist and invalid IDs cannot count towards completion', () => {
  const restored = restorePlan({ selected: ['fish'], completed: ['fish', 'missing', 7] });
  assert.deepEqual([...restored.completed], ['fish']);
  assert.deepEqual([...updatePlan(restored, { type: 'complete', id: 'missing' }).completed], ['fish']);
});

test('marking and unmarking cooked keeps the meal in the shopping plan', () => {
  const plan = restorePlan(null, ['fish']);
  const cooked = updatePlan(plan, { type: 'complete', id: 'fish' });
  assert.ok(cooked.completed.has('fish'));
  assert.ok(cooked.selected.has('fish'));
  assert.equal(plan.completed.size, 0);
  assert.equal(updatePlan(cooked, { type: 'complete', id: 'fish' }).completed.size, 0);
});

test('removing and re-adding a meal starts it uncooked', () => {
  const plan = restorePlan({ selected: ['fish'], completed: ['fish'] });
  const removed = updatePlan(plan, { type: 'toggle', id: 'fish' });
  assert.equal(removed.completed.size, 0);
  const added = updatePlan(removed, { type: 'toggle', id: 'fish' });
  assert.ok(added.selected.has('fish'));
  assert.equal(added.completed.size, 0);
});

test('starting a new week clears selected and cooked meals', () => {
  const plan = updatePlan(restorePlan({ selected: ['fish'], completed: ['fish'] }), { type: 'clear' });
  assert.equal(plan.selected.size, 0);
  assert.equal(plan.completed.size, 0);
});
