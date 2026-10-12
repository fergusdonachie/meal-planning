export const PLAN_STORAGE_KEY = 'weeklyTablePlan';

function ids(value) {
  return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
}

export function restorePlan(saved, legacy = []) {
  const selected = ids(saved?.selected ?? legacy);
  const completed = new Set([...ids(saved?.completed)].filter((id) => selected.has(id)));
  return { selected, completed };
}

export function updatePlan(plan, action) {
  const selected = new Set(plan.selected);
  const completed = new Set(plan.completed);
  if (action.type === 'clear') return restorePlan(null);
  if (action.type === 'toggle') {
    if (selected.has(action.id)) { selected.delete(action.id); completed.delete(action.id); }
    else selected.add(action.id);
  }
  if (action.type === 'complete' && selected.has(action.id)) {
    if (completed.has(action.id)) completed.delete(action.id);
    else completed.add(action.id);
  }
  return { selected, completed };
}
