import { APP_ORIGIN, MORRISONS_ORIGIN, validateImport, productUrl, searchUrl, ingredientQuery, suggestedPacks } from './model.js';
import { readMorrisonsPage, requestAddOnePack } from './product-reader.js';

const $ = (id) => document.getElementById(id);
let state = { shoppingList: null, preferences: {}, checked: {}, activeIngredient: null };
let scanned = null;
let busy = false;
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function status(text) { $('status').textContent = text; }
async function save(patch) { state = { ...state, ...patch }; await chrome.storage.local.set(patch); }
function currentItem() { return state.shoppingList?.items.find((item) => item.key === state.activeIngredient); }
async function activeTab() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return tab; }
async function openMorrisons(url) {
  const tab = await activeTab();
  scanned = null;
  if (tab?.url?.startsWith(MORRISONS_ORIGIN + '/')) await chrome.tabs.update(tab.id, { url });
  else await chrome.tabs.create({ url });
  renderProducts();
}
function action(text, run, disabled = false) {
  const button = element('button', text); button.type = 'button'; button.disabled = disabled;
  button.addEventListener('click', async () => { try { await run(); } catch (error) { status(error.message); } });
  return button;
}
function choose(key) {
  save({ activeIngredient: key }).then(() => { render(); status('Search Morrisons, then read the products on the page.'); }).catch((error) => status(error.message));
}
function render() {
  const items = state.shoppingList?.items || [];
  if (!items.some((item) => item.key === state.activeIngredient)) state.activeIngredient = items[0]?.key || null;
  $('shopping').hidden = !items.length;
  $('progress').textContent = items.length ? `${items.filter((item) => state.checked[item.key]).length} of ${items.length} ingredients checked off` : 'Import your weekly ingredients to get started.';
  const select = $('ingredient'); select.replaceChildren();
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.section)) { const group = element('optgroup'); group.label = item.section; select.append(group); groups.set(item.section, group); }
    const option = element('option', item.label); option.value = item.key; option.selected = item.key === state.activeIngredient; groups.get(item.section).append(option);
  }
  const item = currentItem();
  $('required').textContent = item?.label || '';
  $('query').value = item ? ingredientQuery(item) : '';
  const checklist = $('checklist'); checklist.replaceChildren();
  let lastSection;
  for (const entry of items) {
    if (entry.section !== lastSection) { checklist.append(element('h3', entry.section)); lastSection = entry.section; }
    const row = element('div', null, `check-row ${state.checked[entry.key] ? 'done' : ''}`);
    const check = element('input'); check.type = 'checkbox'; check.checked = Boolean(state.checked[entry.key]); check.setAttribute('aria-label', `Finished shopping for ${entry.label}`);
    check.addEventListener('change', async () => { await save({ checked: { ...state.checked, [entry.key]: check.checked } }); render(); });
    row.append(check, action(entry.label, () => choose(entry.key))); checklist.append(row);
  }
  renderProducts();
}
function renderProducts() {
  const item = currentItem();
  $('preferred').replaceChildren();
  const preferred = item && state.preferences[item.key];
  if (preferred && productUrl(preferred.url)) {
    const card = element('div', null, 'preferred'); card.append(element('h3', 'Your saved choice'), element('p', preferred.name));
    card.append(element('small', `${preferred.size || 'Pack size not stated'} · Saved ${new Date(preferred.checkedAt).toLocaleDateString()}. Open and refresh to check current price and availability.`));
    const actions = element('div', null, 'actions');
    actions.append(action('Find saved product', () => openMorrisons(searchUrl(preferred.name))), action('Forget choice', async () => {
      const preferences = { ...state.preferences }; delete preferences[item.key]; await save({ preferences }); renderProducts();
    })); card.append(actions); $('preferred').append(card);
  }
  const results = $('results'); results.replaceChildren();
  if (!scanned || !item) return;
  if (!scanned.products.length) { results.append(element('p', 'No supported product cards found. Open a Morrisons search-results page, wait for it to load, then refresh.')); return; }
  results.append(element('h2', `Products on this page (${scanned.products.length})`));
  for (const product of scanned.products) {
    const card = element('article', null, 'product'); card.append(element('h3', product.name));
    card.append(element('p', [product.price, product.size].filter(Boolean).join(' · ') || 'Price and pack size not stated'));
    if (product.brand) card.append(element('small', `Brand: ${product.brand}`));
    if (product.offer) card.append(element('small', product.offer));
    const wording = { addable: 'Add available on this page', unavailable: 'Shown as unavailable', unknown: 'Availability needs checking in Morrisons' };
    card.append(element('p', wording[product.availability] || wording.unknown, `availability ${product.availability}`));
    card.append(element('small', `Read at ${new Date(product.checkedAt).toLocaleTimeString()}`));
    const packs = suggestedPacks(item, product.size);
    card.append(element('small', packs ? `Quantity guide: ${packs} pack${packs === 1 ? '' : 's'} for ${item.label}. Check product suitability before adding.` : 'Choose the number of packs in Morrisons.'));
    const actions = element('div', null, 'actions');
    actions.append(action('Use this product', async () => {
      await save({ preferences: { ...state.preferences, [item.key]: { ...product, canAdd: false } } });
      status('Preferred product saved for this ingredient.'); renderProducts();
    }));
    actions.append(action('Add 1 pack in Morrisons', async () => {
      if (busy) return;
      busy = true;
      results.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      try {
        const tab = await activeTab();
        if (!tab || tab.id !== scanned?.tabId || tab.url !== scanned.url) throw new Error('The Morrisons page changed. Read its products again before adding.');
        const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: requestAddOnePack, args: [product.url] });
        status(result.result.message);
        // A click is not proof of a successful basket update. Never auto-check it off or retry.
        scanned = null; renderProducts();
      } finally { busy = false; renderProducts(); }
    }, !product.canAdd));
    const link = element('a', 'Product page ↗'); link.href = product.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link);
    card.append(actions); results.append(card);
  }
}
$('ingredient').addEventListener('change', () => choose($('ingredient').value));
$('search-form').addEventListener('submit', (event) => { event.preventDefault(); openMorrisons(searchUrl($('query').value)).catch((error) => status(error.message)); });
$('scan').addEventListener('click', async () => {
  if (busy) return;
  busy = true; $('scan').disabled = true;
  try {
    const tab = await activeTab();
    if (!tab?.url?.startsWith(MORRISONS_ORIGIN + '/')) throw new Error('Open a Morrisons groceries search-results page first.');
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readMorrisonsPage });
    if (!result?.result) throw new Error('The page could not be read. Wait for Morrisons to finish loading.');
    scanned = { ...result.result, tabId: tab.id }; renderProducts();
    status(`${scanned.products.length} products read from your current Morrisons page.`);
  } catch (error) { scanned = null; renderProducts(); status(error.message); }
  finally { busy = false; $('scan').disabled = false; }
});
$('open-planner').addEventListener('click', () => chrome.tabs.create({ url: APP_ORIGIN + '/week' }));
$('import-file').addEventListener('change', async () => {
  try {
    const file = $('import-file').files[0]; if (!file) return;
    if (file.size > 100000) throw new Error('Choose a Weekly Table export smaller than 100KB.');
    const shoppingList = validateImport(JSON.parse(await file.text()));
    await save({ shoppingList, checked: {}, activeIngredient: null }); scanned = null; render(); status(`${shoppingList.items.length} ingredients imported.`);
  } catch (error) { status(error.message); }
  finally { $('import-file').value = ''; }
});
$('clear-list').addEventListener('click', async () => { await save({ shoppingList: null, checked: {}, activeIngredient: null }); scanned = null; render(); status('Imported list cleared. Your preferred products are kept.'); });
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  for (const key of ['shoppingList', 'preferences', 'checked', 'activeIngredient']) if (changes[key]) state[key] = changes[key].newValue;
  render();
});
chrome.tabs.onUpdated.addListener((tabId, change) => { if (scanned?.tabId === tabId && (change.url || change.status === 'loading')) { scanned = null; renderProducts(); } });
chrome.tabs.onActivated.addListener(() => { scanned = null; renderProducts(); });
state = { ...state, ...await chrome.storage.local.get(['shoppingList', 'preferences', 'checked', 'activeIngredient']) };
render();
