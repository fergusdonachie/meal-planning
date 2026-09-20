const OWNER = import.meta.env.VITE_GITHUB_OWNER || "fergusdonachie";
const REPO = import.meta.env.VITE_GITHUB_REPO || "meal-planning";
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH || "main";

// raw.githubusercontent.com serves the current file on the branch with no
// build step or CDN cache to wait out, so editing data/recipes.json (or
// dropping a file into images/) on GitHub shows up on next page load here.
export const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;

export const RECIPES_URL = `${RAW_BASE}/data/recipes.json`;

export function imageUrl(path) {
  return `${RAW_BASE}/${path}`;
}
