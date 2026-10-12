import { APP_ORIGIN, validateImport } from './model.js';

chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'weekly-table-import') return;
  let origin;
  try { origin = new URL(sender.url).origin; } catch { return; }
  if (sender.id !== chrome.runtime.id || origin !== APP_ORIGIN || !sender.tab) return;
  (async () => {
    try {
      const { batch } = await chrome.storage.local.get('batch');
      if (batch?.status === 'running') throw new Error('Pause the shopping batch in the side panel before importing a new list.');
      const shoppingList = validateImport(message.payload);
      // Importing a new week resets checked-off items; preferred products survive.
      await chrome.storage.local.set({ shoppingList, checked: {}, activeIngredient: null, batch: null });
      sendResponse({ ok: true, count: shoppingList.items.length });
    } catch (error) { sendResponse({ ok: false, error: error.message }); }
  })();
  return true;
});
