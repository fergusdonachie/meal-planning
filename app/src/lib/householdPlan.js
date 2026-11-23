import { validWeek } from './weeklyMenu.js';

const recipeId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(id);
export function validPlan(plan) {
  return plan && ['selected', 'completed'].every((key) => Array.isArray(plan[key]) && plan[key].length <= 100 && plan[key].every(recipeId))
    && new Set(plan.selected).size === plan.selected.length && new Set(plan.completed).size === plan.completed.length
    && plan.completed.every((id) => plan.selected.includes(id));
}
export function validOperation(op) {
  if (!op || !validWeek(op.week) || typeof op.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(op.operationId)) return false;
  switch (op.type) {
    case 'import': return validPlan(op.plan);
    case 'replace': return Array.isArray(op.ids) && op.ids.length <= 100 && op.ids.every(recipeId) && new Set(op.ids).size === op.ids.length;
    case 'select': case 'complete': return recipeId(op.id) && typeof op.value === 'boolean';
    case 'swap': return recipeId(op.id) && recipeId(op.replacement);
    case 'clear': return true;
    default: return false;
  }
}
export function applyOperation(existing, op) {
  const plan = existing || { selected: [], completed: [] };
  if (op.type === 'import') return existing || op.plan;
  if (op.type === 'replace') return { selected: [...op.ids], completed: [] };
  if (op.type === 'clear') return { selected: [], completed: [] };
  const selected = new Set(plan.selected), completed = new Set(plan.completed);
  if (op.type === 'select') {
    if (op.value) selected.add(op.id); else { selected.delete(op.id); completed.delete(op.id); }
  }
  if (op.type === 'complete' && selected.has(op.id)) {
    if (op.value) completed.add(op.id); else completed.delete(op.id);
  }
  if (op.type === 'swap' && selected.has(op.id) && !completed.has(op.id) && !selected.has(op.replacement)) {
    return { selected: plan.selected.map((id) => id === op.id ? op.replacement : id), completed: [...completed] };
  }
  return { selected: [...selected], completed: [...completed] };
}
