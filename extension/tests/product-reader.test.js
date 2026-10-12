import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { readMorrisonsPage, requestAddOnePack } from '../product-reader.js';
const fixture = readFileSync(new URL('./fixtures/morrisons-search.html', import.meta.url), 'utf8');
function page(html = fixture) {
  globalThis.document = parseHTML(html).document;
  globalThis.location = { origin: 'https://groceries.morrisons.com', href: 'https://groceries.morrisons.com/search?q=basmati+rice' };
}

test('current Morrisons product-card HTML yields distinct products, prices and pack sizes', () => {
  page();
  const result = readMorrisonsPage();
  assert.equal(result.products.length, 3);
  const rice = result.products.find((product) => product.name === 'Morrisons Basmati Rice 1kg');
  assert.equal(rice.price, '£1.79');
  assert.equal(rice.size, '1kg');
  assert.equal(rice.url, 'https://groceries.morrisons.com/products/morrisons-basmati-rice-1kg/104544029');
  assert.equal(rice.availability, 'addable');
  assert.equal(rice.canAdd, true);
  assert.ok(rice.checkedAt);
});

test('disabled, missing and out-of-stock controls never imply availability', () => {
  page();
  const first = document.querySelector('.product-card-container');
  first.querySelector('button').setAttribute('aria-disabled', 'true');
  assert.equal(readMorrisonsPage().products[0].availability, 'unknown');
  first.querySelector('button').remove();
  assert.equal(readMorrisonsPage().products[0].canAdd, false);
  const notice = document.createElement('p'); notice.textContent = 'Out of stock'; first.append(notice);
  assert.equal(readMorrisonsPage().products[0].availability, 'unavailable');
});

test('reviewed add clicks only the exact product once and reports a request, not success', () => {
  page();
  const cards = [...document.querySelectorAll('.product-card-container')];
  let clicks = 0;
  cards[1].querySelector('button').click = () => { clicks++; };
  cards[0].querySelector('button').click = () => { throw new Error('Wrong product clicked'); };
  const result = requestAddOnePack('https://groceries.morrisons.com/products/morrisons-basmati-rice-1kg/104544029');
  assert.equal(clicks, 1);
  assert.equal(result.requested, true);
  assert.match(result.message, /Check Morrisons/);
});

test('add refuses missing, disabled and unrelated products without a fallback click', () => {
  page();
  const target = document.querySelectorAll('.product-card-container')[1].querySelector('button');
  target.setAttribute('aria-disabled', 'true');
  target.click = () => { throw new Error('Disabled click'); };
  assert.throws(() => requestAddOnePack('https://groceries.morrisons.com/products/morrisons-basmati-rice-1kg/104544029'), /not currently available/);
  assert.throws(() => requestAddOnePack('https://groceries.morrisons.com/products/missing/123'), /no longer on the page/);
  assert.throws(() => requestAddOnePack('https://evil.example/products/rice/123'), /Invalid/);
});

test('missing site selectors return no products and unrelated origins are refused', () => {
  page('<h1>Sign in</h1><input type="password" value="never-read-me">');
  assert.deepEqual(readMorrisonsPage().products, []);
  location.origin = 'https://evil.example';
  assert.throws(() => readMorrisonsPage(), /Morrisons/);
});

const { inspectBasketProduct, increaseBasketProduct } = await import('../product-reader.js');
const targetUrl = 'https://groceries.morrisons.com/products/morrisons-basmati-rice-1kg/104544029';

test('Morrisons quantity and increment selectors identify existing basket quantities', () => {
  page();
  const card = document.querySelectorAll('.product-card-container')[1];
  card.querySelector('button').remove();
  const input = document.createElement('input'); input.setAttribute('data-test', 'quantity-in-basket'); input.value = '2'; card.append(input);
  const plus = document.createElement('button'); plus.setAttribute('data-test', 'counter:increment'); card.append(plus);
  assert.equal(inspectBasketProduct(targetUrl).quantity, 2);
  assert.equal(inspectBasketProduct(targetUrl).canIncrease, true);
  plus.setAttribute('aria-disabled', 'true');
  assert.equal(inspectBasketProduct(targetUrl).canIncrease, false);
});

test('one Add click is confirmed only after the product counter shows the increment', async () => {
  page();
  const card = document.querySelectorAll('.product-card-container')[1];
  const button = card.querySelector('button');
  let clicks = 0;
  button.click = () => {
    clicks++;
    button.remove();
    const input = document.createElement('input'); input.setAttribute('data-test', 'quantity-in-basket'); input.value = '1'; card.append(input);
  };
  const result = await increaseBasketProduct(targetUrl, 0, 2000);
  assert.equal(clicks, 1); assert.equal(result.confirmed, true); assert.equal(result.quantity, 1);
});

test('a click with no quantity acknowledgement times out without retrying', async () => {
  page(); let clicks = 0;
  document.querySelectorAll('.product-card-container')[1].querySelector('button').click = () => { clicks++; };
  const result = await increaseBasketProduct(targetUrl, 0, 50);
  assert.equal(clicks, 1); assert.equal(result.confirmed, false);
});
