import { APP_ORIGIN, MORRISONS_ORIGIN, validateImport, productUrl, searchUrl, ingredientQuery, suggestedPacks } from './model.js';
import { requestAddOnePack, inspectBasketProduct, increaseBasketProduct, collectMorrisonsResults } from './product-reader.js';
import { matchShoppingList, packQuantity, proposalRows } from './matching.js';
import { prepareBatch, reviewedBatch, recoverBatch, runBatch } from './batch.js';

const $ = (id) => document.getElementById(id);
let state = { shoppingList: null, preferences: {}, checked: {}, activeIngredient: null, batch: null };
let scanned = null;
let busy = false;
let batchRunning = false;
let stopRequested = false;
let runnerTab = null;
let draft = null;
let proposals = null;
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
  const button = element('button', text); button.type = 'button'; button.disabled = disabled || batchRunning;
  button.addEventListener('click', async () => { if (batchRunning) return; try { await run(); } catch (error) { status(error.message); } });
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
  const select = $('ingredient'); select.disabled = batchRunning; select.replaceChildren();
  $('import-file').disabled = batchRunning; $('clear-list').disabled = batchRunning; $('prepare-batch').disabled = batchRunning; $('auto-match').disabled = batchRunning;
  $('scan').disabled = batchRunning;
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
    const check = element('input'); check.type = 'checkbox'; check.checked = Boolean(state.checked[entry.key]); check.disabled = batchRunning; check.setAttribute('aria-label', `Finished shopping for ${entry.label}`);
    check.addEventListener('change', async () => { await save({ checked: { ...state.checked, [entry.key]: check.checked } }); render(); });
    row.append(check, action(entry.label, () => choose(entry.key))); checklist.append(row);
  }
  renderProducts();
  renderBatch();
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
        await save({ preferences: { ...state.preferences, [item.key]: { ...product, canAdd: false } } });
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
$('search-form').addEventListener('submit', (event) => { event.preventDefault(); if (batchRunning) return; openMorrisons(searchUrl($('query').value)).catch((error) => status(error.message)); });
$('scan').addEventListener('click', async () => {
  if (busy) return;
  busy = true; $('scan').disabled = true;
  try {
    const tab = await activeTab();
    if (!tab?.url?.startsWith(MORRISONS_ORIGIN + '/')) throw new Error('Open a Morrisons groceries search-results page first.');
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectMorrisonsResults });
    if (!result?.result) throw new Error('The page could not be read. Wait for Morrisons to finish loading.');
    scanned = { ...result.result, tabId: tab.id }; renderProducts();
    status(`${scanned.products.length} products collected while scrolling the results.${scanned.truncated ? ' Scan limit reached; further products may remain.' : ''}`);
  } catch (error) { scanned = null; renderProducts(); status(error.message); }
  finally { busy = false; $('scan').disabled = false; }
});
$('open-planner').addEventListener('click', () => !batchRunning && chrome.tabs.create({ url: APP_ORIGIN + '/week' }));
$('import-file').addEventListener('change', async () => {
  try {
    if (batchRunning) throw new Error('Pause the batch before importing another list.');
    const file = $('import-file').files[0]; if (!file) return;
    if (file.size > 100000) throw new Error('Choose a Weekly Table export smaller than 100KB.');
    const shoppingList = validateImport(JSON.parse(await file.text()));
    await save({ shoppingList, checked: {}, activeIngredient: null, batch: null }); draft = null; scanned = null; render(); status(`${shoppingList.items.length} ingredients imported.`);
  } catch (error) { status(error.message); }
  finally { $('import-file').value = ''; }
});
$('clear-list').addEventListener('click', async () => { if (batchRunning) return; await save({ shoppingList: null, checked: {}, activeIngredient: null, batch: null }); draft = null; scanned = null; render(); status('Imported list cleared. Your preferred products are kept.'); });
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  for (const key of ['shoppingList', 'preferences', 'checked', 'activeIngredient', 'batch']) if (changes[key]) state[key] = changes[key].newValue;
  if (changes.preferences || changes.shoppingList) { draft = null; if (!batchRunning) proposals = null; }
  render();
});
chrome.tabs.onUpdated.addListener((tabId, change) => { if (scanned?.tabId === tabId && (change.url || change.status === 'loading')) { scanned = null; renderProducts(); } });
chrome.tabs.onActivated.addListener(({ tabId }) => { if (batchRunning && runnerTab != null && tabId !== runnerTab) stopRequested = true; scanned = null; renderProducts(); });
state = { ...state, ...await chrome.storage.local.get(['shoppingList', 'preferences', 'checked', 'activeIngredient', 'batch']) };
state.batch = recoverBatch(state.batch);
if (state.batch) await save({ batch: state.batch });
render();

function renderBatch() {
  const review = $('batch-review'); review.replaceChildren();
  const progress = $('batch-progress'); progress.replaceChildren();
  const batch = state.batch;
  $('pause-batch').hidden = !batchRunning;
  $('resume-batch').hidden = !batch || batchRunning || batch.status === 'complete';
  $('resume-batch').disabled = Boolean(batch?.rows.some((row) => ['uncertain', 'clicking'].includes(row.status)));
  $('discard-batch').hidden = !batch || batchRunning;
  if (batch) {
    progress.append(element('p', `${batch.rows.filter((row) => row.status === 'done').length} of ${batch.rows.length} products confirmed · ${batch.status}`, 'batch-message'));
    if (batch.message) progress.append(element('p', batch.message));
    for (const row of batch.rows) {
      const line = element('div', null, `batch-row ${row.status}`);
      line.append(element('strong', `${row.target} pack${row.target === 1 ? '' : 's'} · ${row.name}`), element('small', row.status));
      if (row.status === 'uncertain') line.append(action('I have checked the basket — allow resume', async () => {
        row.status = 'queued'; row.attempts = 0;
        batch.message = 'The next run will read the actual quantity before adding any more.';
        await save({ batch }); renderBatch();
      }));
      progress.append(line);
    }
    return;
  }
  if (proposals) { renderProposals(review); return; }
  if (!draft) return;
  if (draft.missing.length) {
    review.append(element('p', `${draft.missing.length} ingredients still need a saved product. Choose these before running the whole shop.`));
    for (const item of draft.missing) review.append(action(`Choose: ${item.label}`, () => choose(item.key)));
  }
  for (const row of draft.rows) {
    const card = element('div', null, 'batch-row');
    card.append(element('strong', row.name), element('small', row.ingredients.map((item) => item.label).join(' · ')));
    const label = element('label', 'Total packs wanted in the basket');
    const input = element('input'); input.type = 'number'; input.min = '1'; input.max = '20'; input.step = '1'; input.value = row.target == null ? '' : String(row.target);
    input.setAttribute('aria-label', `Packs of ${row.name}`);
    input.addEventListener('input', () => { row.target = input.value ? Number(input.value) : null; });
    label.append(input); card.append(label);
    if (row.target == null) card.append(element('small', 'Enter a pack count; this ingredient cannot be converted automatically.'));
    review.append(card);
  }
  review.append(action('Add reviewed shopping list to basket', async () => {
    if (draft.missing.length) throw new Error('Choose a saved product for every remaining ingredient first.');
    const rows = reviewedBatch(draft.rows);
    const batch = { listId: state.shoppingList.importedAt, status: 'paused', rows, message: '', createdAt: new Date().toISOString() };
    draft = null; await save({ batch }); await executeBatch(batch);
  }, !draft.rows.length || draft.missing.length > 0));
}

async function executeBatch(batch) {
  if (batchRunning || busy) return;
  if (batch.listId !== state.shoppingList?.importedAt) throw new Error('This batch belongs to an earlier list. Finish it and review your current list.');
  for (const row of batch.rows) {
    if (!['uncertain', 'clicking'].includes(row.status) && row.ingredients.every((item) => state.checked[item.key])) row.status = 'done';
  }
  batchRunning = true; busy = true; stopRequested = false; scanned = null;
  render();
  try {
    const tab = await chrome.tabs.create({ url: MORRISONS_ORIGIN + '/', active: true });
    runnerTab = tab.id;
    const assertTab = async () => {
      if (stopRequested) throw new Error('Paused on request. Keep the Morrisons tab selected while running a batch.');
      const active = await activeTab();
      if (active?.id !== runnerTab) throw new Error('The shopping tab is no longer selected. Resume with Morrisons ready.');
    };
    const inject = async (func, args) => {
      await assertTab();
      const [result] = await chrome.scripting.executeScript({ target: { tabId: runnerTab }, func, args });
      if (!result?.result) throw new Error('Morrisons could not be read. Check the shopping tab before resuming.');
      return result.result;
    };
    const adapter = {
      persist: async (current) => { await save({ batch: structuredClone(current) }); renderBatch(); },
      find: async (row) => {
        await assertTab();
        await chrome.tabs.update(runnerTab, { url: searchUrl(row.name) });
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          await assertTab();
          const tab = await chrome.tabs.get(runnerTab);
          if (tab.status === 'complete' && !tab.pendingUrl && tab.url?.startsWith(MORRISONS_ORIGIN + '/search') && new URL(tab.url).searchParams.get('q') === row.name.trim().slice(0, 300)) {
            const page = await inject(collectMorrisonsResults, [row.url]);
            const observation = await inject(inspectBasketProduct, [row.url]);
            if (observation.found) {
              const current = page.products.find((product) => product.url === row.url);
              if (row.size && current?.size && row.size.trim().toLowerCase() !== current.size.trim().toLowerCase()) throw new Error(`${row.name} has a different pack size now. Finish this batch and review the product again.`);
              return;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        throw new Error(`${row.name} was not found in the current results. Choose a replacement or check Morrisons.`);
      },
      inspect: (row) => inject(inspectBasketProduct, [row.url]),
      increase: (row, before) => inject(increaseBasketProduct, [row.url, before]),
      complete: async (row) => {
        const checked = { ...state.checked }; for (const item of row.ingredients) checked[item.key] = true;
        await save({ checked });
      },
    };
    await runBatch(batch, adapter, () => stopRequested);
    status(batch.message);
  } catch (error) {
    batch.status = 'paused'; batch.message = error.message; await save({ batch }); status(error.message);
  } finally { batchRunning = false; busy = false; runnerTab = null; render(); }
}
$('prepare-batch').addEventListener('click', () => {
  if (batchRunning || state.batch) return;
  proposals = null; draft = prepareBatch(state.shoppingList?.items || [], state.preferences, state.checked); renderBatch();
});
$('pause-batch').addEventListener('click', () => { stopRequested = true; status('Pausing after the current quantity check. No further Add clicks will start.'); });
$('resume-batch').addEventListener('click', () => executeBatch(state.batch).catch((error) => status(error.message)));
$('discard-batch').addEventListener('click', async () => { if (batchRunning) return; await save({ batch: null }); draft = null; proposals = null; renderBatch(); });

function renderProposals(container) {
  const unresolved = proposals.filter((proposal) => !proposal.selected).length;
  container.append(element('p', `${proposals.length - unresolved} ingredients matched · ${unresolved} need a choice. Review the product and packs below.`));
  const totals = element('div', null, 'batch-message');
  const updateTotals = () => { totals.replaceChildren(element('strong', 'Final product totals')); for (const row of proposalRows(proposals)) totals.append(element('p', `${row.target} × ${row.name}`)); };
  for (const proposal of proposals) {
    const card = element('div', null, 'batch-row');
    card.append(element('strong', proposal.item.label));
    if (proposal.candidates.length) {
      const select = element('select'); select.setAttribute('aria-label', `Product for ${proposal.item.label}`);
      for (const candidate of proposal.candidates) {
        const option = element('option', `${candidate.name} · ${candidate.size} · ${candidate.price}`); option.value = candidate.url; option.selected = candidate.url === proposal.selected; select.append(option);
      }
      select.addEventListener('change', () => {
        proposal.selected = select.value;
        const product = proposal.candidates.find((candidate) => candidate.url === select.value);
        const quantity = packQuantity(proposal.item, product); proposal.target = quantity.packs; proposal.note = quantity.reason; proposal.quantityEdited = false;
        renderBatch();
      });
      card.append(select);
      const label = element('label', 'Packs proposed');
      const input = element('input'); input.type = 'number'; input.min = '1'; input.max = '20'; input.step = '1'; input.value = String(proposal.target);
      input.setAttribute('aria-label', `Packs for ${proposal.item.label}`);
      input.addEventListener('input', () => { proposal.target = input.value ? Number(input.value) : null; proposal.quantityEdited = true; updateTotals(); });
      label.append(input); card.append(label, element('small', proposal.note));
    } else {
      card.append(element('p', proposal.note));
      card.append(action('Choose this ingredient manually', () => { const key = proposal.item.key; proposals = null; choose(key); }));
    }
    if (proposal.truncated) card.append(element('small', 'The search reached its scroll limit; more results may exist.'));
    container.append(card);
  }
  updateTotals(); container.append(totals);
  container.append(action('Add the reviewed proposed basket', async () => {
    if (proposals.some((proposal) => !proposal.selected)) throw new Error('Resolve unmatched ingredients before adding the full list.');
    const preferences = { ...state.preferences };
    for (const proposal of proposals) {
      if (!Number.isInteger(proposal.target) || proposal.target < 1 || proposal.target > 20) throw new Error('Check all pack counts (1–20).');
      const product = proposal.candidates.find((candidate) => candidate.url === proposal.selected);
      preferences[proposal.item.key] = { ...product, canAdd: false };
    }
    const rows = reviewedBatch(proposalRows(proposals));
    const batch = { listId: state.shoppingList.importedAt, status: 'paused', rows, message: '', createdAt: new Date().toISOString() };
    proposals = null; draft = null; await save({ preferences, batch }); await executeBatch(batch);
  }, unresolved > 0));
}

$('auto-match').addEventListener('click', async () => {
  if (batchRunning || busy || state.batch) return;
  const items = (state.shoppingList?.items || []).filter((item) => !state.checked[item.key]);
  if (!items.length) return status('All ingredients are already checked off.');
  batchRunning = true; busy = true; stopRequested = false; scanned = null; proposals = null; draft = null; render();
  try {
    const tab = await chrome.tabs.create({ url: MORRISONS_ORIGIN + '/', active: true }); runnerTab = tab.id;
    const assertActive = async () => {
      if (stopRequested || (await activeTab())?.id !== runnerTab) throw new Error('Matching paused. Keep the Morrisons tab selected.');
    };
    proposals = await matchShoppingList(items, state.preferences, {
      progress: async (item, done, total) => { status(`Finding products ${done + 1}/${total}: ${item.label}`); },
      search: async (_item, query) => {
        await assertActive(); await chrome.tabs.update(runnerTab, { url: searchUrl(query) });
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          await assertActive(); const tab = await chrome.tabs.get(runnerTab);
          if (tab.status === 'complete' && !tab.pendingUrl && tab.url?.startsWith(MORRISONS_ORIGIN + '/search') && new URL(tab.url).searchParams.get('q') === query.slice(0, 300)) {
            const [result] = await chrome.scripting.executeScript({ target: { tabId: runnerTab }, func: collectMorrisonsResults });
            if (result?.result) return result.result;
          }
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        throw new Error('Search did not finish loading. Check Morrisons login, consent or stock results.');
      },
    }, () => stopRequested);
    status(stopRequested ? 'Matching paused. Partial proposals are shown; run matching again to cover the full list.' : 'Whole-list matching finished. Review the proposed basket below.');
    if (proposals.length !== items.length) {
      const remaining = items.slice(proposals.length).map((item) => ({ item, candidates: [], selected: null, target: null, note: 'Not searched because matching was paused.' }));
      proposals.push(...remaining);
    }
  } catch (error) { status(error.message); }
  finally { batchRunning = false; busy = false; runnerTab = null; render(); }
});
