import { APP_ORIGIN, MORRISONS_ORIGIN, validateImport, searchUrl, ingredientQuery, suggestedPacks } from './model.js';
import { readMorrisonsPage, inspectBasketProduct, increaseBasketProduct } from './product-reader.js';

const $ = (id) => document.getElementById(id);
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
let state = { shoppingList: null, checked: {}, activeIngredient: null, queries: {} };
let scanned = null;
let busy = false;
let busyOwner = 0;
let generation = 0;
const item = () => state.shoppingList?.items.find((entry) => entry.key === state.activeIngredient);
function status(message) { $('status').textContent = message; }
async function save(patch) { state = { ...state, ...patch }; await chrome.storage.local.set(patch); }
async function activeTab() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return tab; }
function action(text, run, disabled = false) {
  const button = element('button', text); button.type = 'button'; button.disabled = disabled;
  button.addEventListener('click', () => void run().catch((error) => status(error.message)));
  return button;
}
function setBusy(value) {
  busy = value;
  for (const id of ['search', 'scan', 'next', 'skip', 'query', 'import-file', 'clear-list']) $(id).disabled = value;
  $('checklist').querySelectorAll('button, input').forEach((control) => { control.disabled = value; });
  $('results').querySelectorAll('button').forEach((button) => { button.disabled = value || button.dataset.unavailable === 'true'; });
  $('search').textContent = value ? 'Working…' : 'Search Morrisons';
}
function render() {
  const items = state.shoppingList?.items || [];
  if (!items.some((entry) => entry.key === state.activeIngredient) || state.checked[state.activeIngredient]) state.activeIngredient = items.find((entry) => !state.checked[entry.key])?.key || null;
  const current = item();
  const done = items.filter((entry) => state.checked[entry.key]).length;
  $('empty').hidden = Boolean(items.length); $('shopping').hidden = !items.length;
  $('current').hidden = !current; $('finished').hidden = Boolean(current) || !items.length;
  $('progress').textContent = `${done} of ${items.length} ingredients checked off`;
  $('position').textContent = current ? `Item ${items.indexOf(current) + 1} of ${items.length} · ${current.section}` : '';
  $('required').textContent = current?.label || '';
  $('query').value = current ? state.queries[current.key] || ingredientQuery(current) : '';
  const list = $('checklist'); list.replaceChildren();
  let lastSection;
  for (const entry of items) {
    if (entry.section !== lastSection) { list.append(element('h3', entry.section)); lastSection = entry.section; }
    const row = element('div', null, `check-row ${state.checked[entry.key] ? 'done' : ''} ${entry.key === current?.key ? 'current' : ''}`);
    const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(state.checked[entry.key]);
    checkbox.setAttribute('aria-label', `Finished shopping for ${entry.label}`);
    checkbox.addEventListener('change', async () => {
      generation++; scanned = null;
      await save({ checked: { ...state.checked, [entry.key]: checkbox.checked }, activeIngredient: checkbox.checked ? state.activeIngredient : entry.key });
      render(); status('Checklist updated. Search when you’re ready.');
    });
    row.append(checkbox, action(entry.label, () => choose(entry.key))); list.append(row);
  }
  renderProducts(); setBusy(busy);
}
async function choose(key) {
  if (busy) return;
  generation++; scanned = null;
  await save({ activeIngredient: key, checked: { ...state.checked, [key]: false } });
  render(); $('required').focus(); status('Check the search term, then search Morrisons.');
}
function renderProducts() {
  const results = $('results'); results.replaceChildren();
  const current = item();
  if (!current || !scanned || scanned.key !== current.key) return;
  if (!scanned.products.length) { results.append(element('p', 'No products found on this page yet. Check Morrisons for sign-in or cookie prompts, change the search term, or refresh the products.')); return; }
  results.append(element('h3', `${scanned.products.length} product option${scanned.products.length === 1 ? "" : "s"}`), element('p', 'Showing products loaded on the Morrisons page. Scroll there and refresh for more.', 'hint'));
  for (const product of scanned.products) {
    const card = element('article', null, 'product'); card.append(element('h3', product.name));
    card.append(element('p', [product.price, product.size].filter(Boolean).join(' · ') || 'Check price and pack size in Morrisons'));
    if (product.offer) card.append(element('small', product.offer));
    const packs = suggestedPacks(current, product.size);
    if (packs) card.append(element('p', `Quantity guide: ${packs} pack${packs === 1 ? '' : 's'} for ${current.label}.`, 'hint'));
    if (product.availability === 'unavailable') card.append(element('p', 'Currently unavailable', 'unavailable'));
    const actions = element('div', null, 'actions');
    const add = action('Add 1 pack', () => addProduct(product), !product.canAdd);
    add.dataset.unavailable = String(!product.canAdd);
    const link = element('a', 'View in Morrisons ↗'); link.href = product.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    actions.append(add, link); card.append(actions); results.append(card);
  }
}
async function requirePage(tabId, url) {
  const tab = await activeTab();
  if (tab?.id !== tabId || tab.url !== url || tab.pendingUrl) throw new Error('The Morrisons page changed. Refresh its products before adding.');
  return tab;
}
async function addProduct(product) {
  if (busy || !scanned) return;
  const page = scanned, token = generation;
  const owner = ++busyOwner; setBusy(true);
  try {
    await requirePage(page.tabId, page.url);
    const [before] = await chrome.scripting.executeScript({ target: { tabId: page.tabId }, func: inspectBasketProduct, args: [product.url] });
    if (token !== generation) return;
    if (!before?.result?.found || !Number.isInteger(before.result.quantity) || !before.result.canIncrease) throw new Error('Use the product’s basket controls in Morrisons, or refresh the products.');
    await requirePage(page.tabId, page.url);
    const [added] = await chrome.scripting.executeScript({ target: { tabId: page.tabId }, func: increaseBasketProduct, args: [product.url, before.result.quantity] });
    if (token !== generation) return;
    status(added?.result?.confirmed ? `Morrisons shows ${added.result.quantity} pack${added.result.quantity === 1 ? '' : 's'} of ${product.name} in the basket. Add more if needed, then choose “Added it — next item”.` : 'The basket update could not be confirmed. Check Morrisons before adding again or moving on.');
    // Never retry an uncertain basket action or advance without the user's Next click.
  } catch (error) { status(error.message); }
  finally { if (owner === busyOwner) setBusy(false); }
}
async function readPage(tab, key) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readMorrisonsPage });
  if (!result?.result || result.result.url !== tab.url) throw new Error('The page changed while reading products. Refresh and try again.');
  return { ...result.result, tabId: tab.id, key };
}
async function searchCurrent() {
  if (busy || !item()) return;
  const current = item(), query = $('query').value.trim();
  if (!query) return status('Enter a search term first.');
  const token = ++generation;
  scanned = null; renderProducts(); const owner = ++busyOwner; setBusy(true); status(`Searching Morrisons for ${query}…`);
  try {
    await save({ queries: { ...state.queries, [current.key]: query } });
    const url = searchUrl(query), active = await activeTab();
    const tab = active?.url?.startsWith(MORRISONS_ORIGIN + '/') ? await chrome.tabs.update(active.id, { url }) : await chrome.tabs.create({ url, active: true });
    const deadline = Date.now() + 30000;
    let readyAt;
    const matchesSearch = (value) => {
      try { const parsed = new URL(value); return parsed.origin === MORRISONS_ORIGIN && parsed.pathname === "/search" && parsed.searchParams.get("q") === query.slice(0, 300); } catch { return false; }
    };
    while (Date.now() < deadline && token === generation) {
      const loaded = await chrome.tabs.get(tab.id);
      if ((await activeTab())?.id !== tab.id) throw new Error('Search paused because you switched tabs. Return to Morrisons and search again.');
      if (loaded.status === 'complete' && !loaded.pendingUrl && matchesSearch(loaded.url)) {
        readyAt ??= Date.now();
        const page = await readPage(loaded, current.key);
        if (token !== generation) return;
        if (page.products.length || Date.now() - readyAt >= 4000) { scanned = page; renderProducts(); status(`Choose a product for ${current.label}.`); return; }
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    if (token === generation) status('Morrisons is taking a while. Check the page for sign-in or cookie prompts, then refresh the products.');
  } catch (error) { if (token === generation) status(error.message); }
  finally { if (owner === busyOwner) setBusy(false); }
}
async function advance(done) {
  if (busy || !item()) return;
  const current = item(), items = state.shoppingList.items;
  const checked = { ...state.checked, ...(done ? { [current.key]: true } : {}) };
  const index = items.indexOf(current);
  const next = [...items.slice(index + 1), ...items.slice(0, index)].find((entry) => !checked[entry.key]);
  if (!done && !next) return status('This is the last unfinished ingredient. Change its search term, or finish it after adding in Morrisons.');
  const token = ++generation, owner = ++busyOwner;
  scanned = null; setBusy(true);
  try {
    await save({ checked, activeIngredient: next?.key || null });
    if (token !== generation) return;
    render();
  } finally { if (owner === busyOwner) setBusy(false); }
  if (token !== generation) return;
  if (next) { $('required').focus(); await searchCurrent(); }
  else status('Shopping list complete. Review your basket in Morrisons.');
}
$('search-form').addEventListener('submit', (event) => { event.preventDefault(); void searchCurrent(); });
$('next').addEventListener('click', () => void advance(true).catch((error) => status(error.message)));
$('skip').addEventListener('click', () => void advance(false).catch((error) => status(error.message)));
$('scan').addEventListener('click', async () => {
  if (busy || !item()) return;
  const token = ++generation, key = item().key;
  const owner = ++busyOwner; setBusy(true); scanned = null;
  try {
    const tab = await activeTab();
    if (!tab?.url?.startsWith(MORRISONS_ORIGIN + '/')) throw new Error('Open Morrisons first, then refresh its products.');
    const page = await readPage(tab, key);
    if (token !== generation) return;
    scanned = page; renderProducts(); status('Products refreshed from the open Morrisons page.');
  } catch (error) { if (token === generation) status(error.message); }
  finally { if (owner === busyOwner) setBusy(false); }
});
$('open-planner').addEventListener('click', () => chrome.tabs.create({ url: APP_ORIGIN + '/week' }));
$('import-file').addEventListener('change', async () => {
  if (busy) return;
  try {
    const file = $('import-file').files[0]; if (!file) return;
    if (file.size > 100000) throw new Error('Choose a Weekly Table export smaller than 100KB.');
    const shoppingList = validateImport(JSON.parse(await file.text()));
    generation++; scanned = null;
    await save({ shoppingList, checked: {}, activeIngredient: null, queries: {}, batch: null }); render(); status('List received. Check the first search term to start shopping.');
  } catch (error) { status(error.message); }
  finally { $('import-file').value = ''; }
});
$('clear-list').addEventListener('click', async () => {
  if (busy) return;
  generation++; scanned = null;
  await save({ shoppingList: null, checked: {}, activeIngredient: null, queries: {}, batch: null }); render(); status('Imported list cleared.');
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const replaced = changes.shoppingList && changes.shoppingList.newValue?.importedAt !== state.shoppingList?.importedAt;
  if (replaced) { generation++; busyOwner++; scanned = null; busy = false; status('New list received. Check the first search term to start shopping.'); }
  for (const key of ['shoppingList', 'checked', 'activeIngredient', 'queries']) if (changes[key]) state[key] = changes[key].newValue;
  render();
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (scanned?.tabId === tabId && (change.url || change.status === 'loading')) { generation++; scanned = null; renderProducts(); status('Page changed. Refresh products or search this ingredient again.'); }
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (scanned && scanned.tabId !== tabId) { generation++; scanned = null; renderProducts(); status('Return to Morrisons and refresh the products when ready.'); }
});
state = { ...state, ...await chrome.storage.local.get(['shoppingList', 'checked', 'activeIngredient', 'queries']) };
render();
