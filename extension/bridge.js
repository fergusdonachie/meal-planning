// Receives only the deliberately exported ingredient list, never credentials.
window.addEventListener('message', async (event) => {
  if (event.source !== window || event.origin !== 'https://fd-meal-planner.vercel.app' || event.data?.type !== 'weekly-table-export') return;
  const { requestId, payload } = event.data;
  if (typeof requestId !== 'string' || requestId.length > 100) return;
  let result;
  try { result = await chrome.runtime.sendMessage({ type: 'weekly-table-import', payload }); }
  catch { result = { ok: false, error: 'Reload this page after installing or updating the extension.' }; }
  window.postMessage({ type: 'weekly-table-export-result', requestId, ...result }, event.origin);
});
