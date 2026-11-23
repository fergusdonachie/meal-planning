import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { searchUrl } from '../model.js';
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
async function settle(document) {
  for (let i = 0; i < 100 && document.getElementById('query').disabled; i++) await pause();
  await pause();
}
let serial = 0;
async function setup() {
  const { document, window } = parseHTML(readFileSync(new URL('../panel.html', import.meta.url), 'utf8'));
  window.HTMLElement.prototype.focus = () => {};
  globalThis.document = document;
  const items = ['rice', 'carrots', 'beans'].map((name) => ({ key: name, name, label: `500g ${name}`, section: 'Ingredients', amounts: [{ unit: 'g', quantity: 500 }] }));
  const state = { shoppingList: { importedAt: 'test-list', items }, checked: {}, activeIngredient: null, queries: {} };
  let tab = { id: 1, status: 'complete', url: 'https://groceries.morrisons.com/' };
  const searched = [], reads = [], adds = [];
  let quantity = 0, confirmed = true, onChange, onUpdate;
  let deferredRead = null;
  const product = { name: 'Rice <script>unsafe</script>', size: '1kg', price: '£1.79', canAdd: true, url: 'https://groceries.morrisons.com/products/rice/123', availability: 'addable' };
  globalThis.chrome = {
    storage: { local: { get: async () => structuredClone(state), set: async (patch) => Object.assign(state, structuredClone(patch)) }, onChanged: { addListener(fn) { onChange = fn; } } },
    tabs: {
      onUpdated: { addListener(fn) { onUpdate = fn; } }, onActivated: { addListener() {} },
      create: async (options) => { tab.url = options.url; searched.push(options.url); return tab; },
      query: async () => [tab], get: async () => tab,
      update: async (_id, options) => { tab.url = options.url; searched.push(options.url); return tab; },
    },
    scripting: { executeScript: async ({ func, args }) => {
      if (func.name === 'readMorrisonsPage') {
        reads.push(tab.url);
        if (deferredRead) await deferredRead;
        return [{ result: { url: tab.url, products: [product] } }];
      }
      if (func.name === 'inspectBasketProduct') return [{ result: { found: true, quantity, canIncrease: true } }];
      if (func.name === 'increaseBasketProduct') { adds.push(args); if (confirmed) quantity++; return [{ result: { confirmed, quantity, clicked: true } }]; }
      throw new Error(`Unexpected script ${func.name}`);
    } },
  };
  await import(`../panel.js?test=${++serial}`);
  const click = (id) => document.getElementById(id).click();
  const search = () => document.getElementById('search-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  return { document, state, searched, reads, adds, click, search, product,
    confirm: (value) => { confirmed = value; },
    defer: (promise) => { deferredRead = promise; },
    replace: (list) => onChange({ shoppingList: { newValue: list }, checked: { newValue: {} }, activeIngredient: { newValue: null }, queries: { newValue: {} } }, 'local'),
    navigate: () => { tab.url = 'https://groceries.morrisons.com/'; onUpdate(1, { status: 'loading' }); },
  };
}
test('shops only the reviewed ingredient, checks it off on Next, skips without checking and resumes saved progress', async () => {
  const h = await setup(), { document, state } = h;
  assert.equal(h.searched.length, 0, 'import must not start searches');
  assert.equal(document.querySelectorAll('#checklist .check-row').length, 3);
  assert.equal(document.getElementById('query').value, 'rice');
  document.getElementById('query').value = 'brown rice'; h.search(); await settle(document);
  assert.deepEqual(h.searched, [searchUrl('brown rice')]);
  assert.equal(h.reads.length, 1, 'one page read, no whole-list scan');
  assert.match(document.getElementById('results').textContent, /Rice <script>unsafe<\/script>/);
  assert.equal(document.querySelector('#results script'), null);
  document.querySelector('#results button').click(); await settle(document);
  assert.equal(h.adds.length, 1); assert.deepEqual(state.checked, {});
  assert.equal(h.searched.length, 1, 'adding must not advance automatically');
  h.click('next'); await settle(document);
  assert.equal(state.checked.rice, true);
  assert.equal(state.activeIngredient, 'carrots');
  assert.deepEqual(h.searched, [searchUrl('brown rice'), searchUrl('carrots')]);
  h.click('skip'); await settle(document);
  assert.equal(Boolean(state.checked.carrots), false);
  assert.equal(state.activeIngredient, 'beans');
  assert.equal(h.searched.length, 3);
  h.click('next'); await settle(document);
  assert.equal(state.checked.beans, true); assert.equal(state.activeIngredient, 'carrots');
  h.click('next'); await settle(document);
  assert.equal(document.getElementById('finished').hidden, false);
  assert.equal(document.getElementById('current').hidden, true);
  assert.equal(h.searched.length, 4, 'no final search after completing list');
  await import(`../panel.js?test=${++serial}`);
  assert.equal(document.getElementById('finished').hidden, false);
  assert.equal(h.searched.length, 4, 'reopening does not run searches');
});
test('uncertain adds do not retry or check off, and changed pages cannot add stale products', async () => {
  const h = await setup(); h.search(); await settle(h.document); h.confirm(false);
  h.document.querySelector('#results button').click(); await settle(h.document);
  assert.equal(h.adds.length, 1); assert.deepEqual(h.state.checked, {});
  assert.match(h.document.getElementById('status').textContent, /could not be confirmed/);
  h.navigate();
  assert.equal(h.document.querySelectorAll('#results button').length, 0);
  assert.equal(h.adds.length, 1);
});
test('a new imported list invalidates in-flight products and resets the current ingredient', async () => {
  const h = await setup();
  let resolve; h.defer(new Promise((done) => { resolve = done; }));
  h.search(); await pause(); await pause();
  h.replace({ importedAt: 'new-list', items: [{ key: 'lemons', name: 'lemons', label: '2 lemons', section: 'Produce' }] });
  resolve(); await settle(h.document);
  assert.equal(h.document.getElementById('required').textContent, '2 lemons');
  assert.equal(h.document.querySelectorAll('#results .product').length, 0);
  assert.equal(h.document.getElementById('query').disabled, false);
});
test('a double click on Next cannot check off an ingredient that has not been shopped', async () => {
  const h = await setup();
  h.click('next'); h.click('next'); await settle(h.document);
  assert.deepEqual(h.state.checked, { rice: true });
  assert.equal(h.state.activeIngredient, 'carrots');
  assert.deepEqual(h.searched, [searchUrl('carrots')]);
});
