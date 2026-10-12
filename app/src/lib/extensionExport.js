export function extensionShoppingList(sections) {
  return {
    version: 1,
    items: sections.flatMap((section) => section.entries.map((entry) => ({
      key: entry.key,
      name: entry.name,
      label: entry.label,
      section: section.title,
      amounts: [...entry.amounts].map(([unit, quantity]) => ({ unit, quantity })),
    }))),
  };
}

export function sendShoppingListToExtension(payload) {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    function finish(result) {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve(result);
    }
    function onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin
        || event.data?.type !== 'weekly-table-export-result' || event.data.requestId !== requestId) return;
      finish(event.data);
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'Install the extension and reload this page, or download the shopping-list file to import manually.' }), 2500);
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'weekly-table-export', requestId, payload }, window.location.origin);
  });
}

export function downloadShoppingList(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'weekly-table-shopping-list.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
