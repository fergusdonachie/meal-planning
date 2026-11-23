import { restorePlan, updatePlan } from './weekPlan.js';
import { currentWeek, validWeek } from './weeklyMenu.js';

export const PLANNER_KEY = 'weeklyTableWeeks';
export function restorePlanner(saved, legacy = null, today = currentWeek()) {
  const weeks = {};
  if (saved?.version === 1 && saved.weeks && typeof saved.weeks === 'object') {
    for (const [week, plan] of Object.entries(saved.weeks)) if (validWeek(week)) weeks[week] = restorePlan(plan);
  } else if (legacy) weeks[today] = restorePlan(legacy);
  return { week: today, weeks };
}
export function serializePlanner(planner) {
  return { version: 1, weeks: Object.fromEntries(Object.entries(planner.weeks).map(([week, plan]) => [week, { selected: [...plan.selected], completed: [...plan.completed] }])) };
}
export function updatePlanner(planner, action) {
  if (action.type === 'week') return validWeek(action.week) ? { ...planner, week: action.week } : planner;
  const plan = planner.weeks[planner.week] || restorePlan(null);
  if (action.type === 'swap') {
    if (!plan.selected.has(action.id) || plan.completed.has(action.id) || plan.selected.has(action.replacement) || typeof action.replacement !== 'string') return planner;
    const selected = new Set([...plan.selected].map((id) => id === action.id ? action.replacement : id));
    return { ...planner, weeks: { ...planner.weeks, [planner.week]: { selected, completed: new Set(plan.completed) } } };
  }
  const next = action.type === 'replace' ? restorePlan({ selected: action.ids }) : updatePlan(plan, action);
  return { ...planner, weeks: { ...planner.weeks, [planner.week]: next } };
}
