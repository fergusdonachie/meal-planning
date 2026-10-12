import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

test('the panel opens a reviewed batch with explicit pack quantities and safe product text', async () => {
  const { document } = parseHTML(readFileSync(new URL('../panel.html', import.meta.url), 'utf8'));
  globalThis.document = document;
  const state = {
    shoppingList: { importedAt: 'test-week', items: [{ key: 'rice', name: 'rice', label: '500g rice', section: 'Grains', amounts: [{ unit: 'g', quantity: 500 }] }] },
    preferences: { rice: { name: 'Rice <script>unsafe</script>', url: 'https://groceries.morrisons.com/products/rice/123', size: '1kg', checkedAt: new Date().toISOString() } },
    checked: {}, activeIngredient: 'rice', batch: null,
  };
  globalThis.chrome = {
    storage: { local: { get: async () => state, set: async () => {} }, onChanged: { addListener() {} } },
    tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} } },
  };
  await import('../panel.js');
  document.getElementById('prepare-batch').click();
  const review = document.getElementById('batch-review');
  assert.equal(review.querySelector('input[type=number]').value, '1');
  assert.match(review.textContent, /Total packs wanted in the basket/);
  assert.match(review.textContent, /Rice <script>unsafe<\/script>/);
  assert.equal(review.querySelector('script'), null);
  assert.equal(review.querySelector('button').disabled, false);
});
