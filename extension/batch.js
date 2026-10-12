import { productUrl, suggestedPacks } from './model.js';

// Every target is reviewed in the panel. Duplicate product choices become one basket line.
export function prepareBatch(items, preferences, checked = {}) {
  const groups = new Map();
  const missing = [];
  for (const item of items) {
    if (checked[item.key]) continue;
    const choice = preferences[item.key];
    const url = productUrl(choice?.url);
    if (!url) { missing.push(item); continue; }
    if (!groups.has(url)) groups.set(url, { url, name: choice.name, size: choice.size || '', ingredients: [], amounts: [], comparable: true });
    const group = groups.get(url);
    group.ingredients.push({ key: item.key, label: item.label });
    group.amounts.push(...item.amounts);
    if (choice.size !== group.size || suggestedPacks(item, group.size) === null) group.comparable = false;
  }
  const rows = [...groups.values()].map((group) => ({
    ...group,
    target: group.comparable ? suggestedPacks({ amounts: group.amounts }, group.size) : null,
    status: 'queued',
  }));
  return { rows, missing };
}

export function reviewedBatch(rows) {
  if (!rows.length) throw new Error('Choose products for your remaining ingredients first.');
  const urls = new Set();
  let total = 0;
  return rows.map((row) => {
    if (!productUrl(row.url) || urls.has(row.url)) throw new Error('Each product must appear once in the batch.');
    urls.add(row.url);
    if (!Number.isInteger(row.target) || row.target < 1 || row.target > 20) throw new Error('Review a quantity of 1–20 packs for every product.');
    total += row.target;
    if (total > 200) throw new Error('Limit a batch to 200 packs.');
    return { url: row.url, name: row.name, size: row.size, ingredients: row.ingredients, target: row.target, status: 'queued', attempts: 0 };
  });
}

// Side-panel closure/reload never automatically resumes a potentially in-flight click.
export function recoverBatch(batch) {
  if (!batch) return null;
  if (batch.status !== 'running') return batch;
  return { ...batch, status: 'paused', message: 'The batch was interrupted. Inspect the basket before resuming.', rows: batch.rows.map((row) => row.status === 'clicking' ? { ...row, status: 'uncertain' } : row) };
}

export async function runBatch(batch, adapter, shouldStop = () => false) {
  const checkpoint = async () => adapter.persist(batch);
  batch.status = 'running';
  batch.message = '';
  await checkpoint();
  try {
    for (const row of batch.rows) {
      if (row.status === 'done') continue;
      if (row.status === 'uncertain' || row.status === 'clicking') throw new Error(`Check ${row.name} in the basket and acknowledge the interrupted action before resuming.`);
      if (shouldStop()) { batch.status = 'paused'; batch.message = 'Paused. Resume when you are ready.'; await checkpoint(); return batch; }
      row.status = 'finding'; await checkpoint();
      await adapter.find(row);
      let observation = await adapter.inspect(row);
      if (!Number.isInteger(observation.quantity)) throw new Error(`Could not read the basket quantity for ${row.name}.`);
      while (observation.quantity < row.target) {
        if (shouldStop()) { row.status = 'queued'; batch.status = 'paused'; batch.message = 'Paused before the next Add click.'; await checkpoint(); return batch; }
        if (!observation.canIncrease) throw new Error(`${row.name} cannot currently be added. Check stock, limits or login in Morrisons.`);
        if (++row.attempts > row.target + 2) throw new Error(`Unexpected quantity changes for ${row.name}. Inspect the basket before continuing.`);
        const before = observation.quantity;
        row.status = 'clicking'; row.expectedQuantity = before + 1; await checkpoint();
        // If this call times out or the panel closes, do not blindly retry the click.
        const after = await adapter.increase(row, before);
        if (!after.confirmed || after.quantity !== before + 1) {
          row.status = 'uncertain'; batch.status = 'paused'; batch.message = `An Add click for ${row.name} could not be confirmed. Check its quantity in Morrisons.`;
          await checkpoint(); return batch;
        }
        observation = after;
        row.status = 'finding'; row.lastQuantity = after.quantity; await checkpoint();
        // Read fresh controls before each additional pack.
        observation = await adapter.inspect(row);
        if (!Number.isInteger(observation.quantity)) throw new Error(`The basket quantity for ${row.name} is no longer readable.`);
      }
      row.status = 'done'; row.lastQuantity = observation.quantity; await checkpoint();
      await adapter.complete(row);
    }
    batch.status = 'complete'; batch.message = 'Reviewed quantities are shown in the basket. Check the full trolley in Morrisons before ordering.';
  } catch (error) {
    const row = batch.rows.find((entry) => ['finding', 'clicking'].includes(entry.status));
    if (row) row.status = row.status === 'clicking' ? 'uncertain' : 'blocked';
    batch.status = 'paused'; batch.message = error.message;
  }
  await checkpoint();
  return batch;
}
