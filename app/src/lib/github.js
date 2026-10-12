const OWNER = import.meta.env.VITE_GITHUB_OWNER || "fergusdonachie";
const REPO = import.meta.env.VITE_GITHUB_REPO || "meal-planning";
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH || "main";

// Production checks GitHub for published updates. Local development uses the
// working tree; deployed builds also include a snapshot if GitHub is unavailable.
export const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;

export const LOCAL_RECIPES_URL = '/data/recipes.json';
export const RECIPES_URL = import.meta.env.DEV ? LOCAL_RECIPES_URL : `${RAW_BASE}/data/recipes.json`;

export function imageUrl(path) {
  return import.meta.env.DEV ? `/${path}` : `${RAW_BASE}/${path}`;
}
