import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBatch, reviewedBatch, recoverBatch, runBatch } from '../batch.js';
const url = 'https://groceries.morrisons.com/products/rice/123';
const item = (key, grams) => ({ key, label: `${grams}g rice`, amounts: [{ unit: 'g', quantity: grams }] });
const choice = { url, name: 'Rice 1kg', size: '1kg' };
const row = (target = 2) => ({ url, name: 'Rice 1kg', target, status: 'queued', attempts: 0, ingredients: [{ key: 'rice', label: 'Rice' }] });
function harness(initial = 0) {
  let quantity = initial;
  let clicks = 0;
  const checkpoints = [];
  const adapter = {
    persist: async (batch) => { checkpoints.push(structuredClone(batch)); },
    find: async () => {},
    inspect: async () => ({ quantity, canIncrease: true }),
    increase: async (_row, before) => { assert.equal(before, quantity); clicks++; quantity++; return { confirmed: true, quantity }; },
    complete: async () => {},
  };
  return { adapter, checkpoints, clicks: () => clicks };
}

test('duplicate preferred products merge quantities before rounding to packs', () => {
  const prepared = prepareBatch([item('a', 600), item('b', 300)], { a: choice, b: choice });
  assert.equal(prepared.rows.length, 1);
  assert.equal(prepared.rows[0].target, 1);
  assert.equal(prepared.rows[0].ingredients.length, 2);
});

test('unmatched ingredients remain explicit and unknown measures require reviewed quantities', () => {
  const prepared = prepareBatch([item('a', 600), { key: 'b', label: '1 onion', amounts: [{ unit: 'count', quantity: 1 }] }], { a: choice });
  assert.equal(prepared.missing[0].key, 'b');
  const unknown = prepareBatch([{ key: 'b', label: '1 onion', amounts: [] }], { b: choice });
  assert.equal(unknown.rows[0].target, null);
  assert.throws(() => reviewedBatch(unknown.rows), /Review a quantity/);
});

test('review rejects duplicate SKUs and out-of-range pack counts', () => {
  assert.throws(() => reviewedBatch([row(), row()]), /appear once/);
  assert.throws(() => reviewedBatch([row(0)]), /Review/);
  assert.throws(() => reviewedBatch([row(21)]), /Review/);
});

test('a batch tops up to a target rather than adding the target again to an existing basket', async () => {
  const h = harness(1);
  const batch = { rows: [row(3)] };
  await runBatch(batch, h.adapter);
  assert.equal(h.clicks(), 2);
  assert.equal(batch.status, 'complete');
  assert.equal(batch.rows[0].lastQuantity, 3);
  assert.ok(h.checkpoints.some((saved) => saved.rows[0].status === 'clicking'));
});

test('already satisfied basket quantities do not cause clicks', async () => {
  const h = harness(4); const batch = { rows: [row(2)] };
  await runBatch(batch, h.adapter);
  assert.equal(h.clicks(), 0); assert.equal(batch.rows[0].status, 'done');
});

test('an uncertain click pauses immediately without retrying or advancing to another product', async () => {
  const h = harness();
  let attempts = 0;
  h.adapter.increase = async () => { attempts++; return { confirmed: false, quantity: 0 }; };
  const batch = { rows: [row(2), { ...row(), url: 'https://groceries.morrisons.com/products/other/456' }] };
  await runBatch(batch, h.adapter);
  assert.equal(attempts, 1); assert.equal(batch.status, 'paused');
  assert.equal(batch.rows[0].status, 'uncertain'); assert.equal(batch.rows[1].status, 'queued');
  await runBatch(batch, h.adapter);
  assert.equal(attempts, 1);
});

test('stop pauses before any further clicks and interruption recovery requires review', async () => {
  const h = harness(); const batch = { rows: [row()] };
  await runBatch(batch, h.adapter, () => true);
  assert.equal(h.clicks(), 0); assert.equal(batch.status, 'paused');
  const recovered = recoverBatch({ status: 'running', rows: [{ ...row(), status: 'clicking' }] });
  assert.equal(recovered.status, 'paused'); assert.equal(recovered.rows[0].status, 'uncertain');
});

test('unavailable or unrecognised controls stop a batch before clicking', async () => {
  const h = harness(); h.adapter.inspect = async () => ({ quantity: 0, canIncrease: false });
  const batch = { rows: [row()] };
  await runBatch(batch, h.adapter);
  assert.equal(h.clicks(), 0); assert.equal(batch.rows[0].status, 'blocked');
});
