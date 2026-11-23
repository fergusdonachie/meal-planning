// Calendar weeks use household time, even when a phone is travelling.
export function currentWeek(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  const day = new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}

export function shiftWeek(week, offset) {
  const date = new Date(`${week}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset * 7);
  return date.toISOString().slice(0, 10);
}

export function weekLabel(week) {
  const format = (value) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(value);
  const end = new Date(`${week}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${format(new Date(`${week}T12:00:00Z`))} – ${format(end)} ${end.getUTCFullYear()}`;
}

export function validWeek(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

function rank(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

// Two fish dinners, chicken and a vegetarian meal; the fifth varies by week.
// Rotate cuisine, favour shorter recipes and avoid the previous week's meals.
export function suggestMeals(recipes, week, count = 5, previous = [], variation = 0) {
  const available = [...new Map(recipes.map((recipe) => [recipe.id, recipe])).values()];
  const chosen = [];
  const proteins = ['Fish', 'Vegetarian', 'Chicken', 'Fish', null];
  const old = new Set(previous);
  for (let index = 0; index < Math.min(count === 4 ? 4 : 5, available.length); index++) {
    const candidates = available.filter((recipe) => !chosen.some((meal) => meal.id === recipe.id));
    const protein = proteins[index];
    const matching = candidates.filter((recipe) => protein ? recipe.protein === protein : recipe.protein !== 'Fish');
    const pool = matching.length ? matching : candidates;
    const score = (recipe) => (old.has(recipe.id) ? 100 : 0)
      + chosen.filter((meal) => meal.cuisine === recipe.cuisine).length * 15
      + (recipe.time > 40 ? 8 : 0)
      + rank(`${week}:${variation}:${recipe.id}`) / 4294967296 * 7;
    pool.sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));
    chosen.push(pool[0]);
  }
  return chosen.map((recipe) => recipe.id);
}
