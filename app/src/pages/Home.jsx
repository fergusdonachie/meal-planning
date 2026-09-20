import { useMemo, useState } from "react";
import RecipeCard from "../components/RecipeCard";
import FilterBar from "../components/FilterBar";

const INITIAL_FILTERS = { cuisine: new Set(), protein: new Set(), time: null, search: "" };

export default function Home({ recipes }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (filters.cuisine.size && !filters.cuisine.has(r.cuisine)) return false;
      if (filters.protein.size) {
        const wants = [...filters.protein];
        const ok = wants.some((p) => (p === "Fish" ? r.fish : r.protein === p));
        if (!ok) return false;
      }
      if (filters.time && r.time > filters.time) return false;
      if (filters.search) {
        const hay = `${r.title} ${r.blurb} ${r.ingredients.join(" ")} ${r.cuisine}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [recipes, filters]);

  function toggleSet(key, value) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  const avgTime = Math.round(recipes.reduce((a, r) => a + r.time, 0) / recipes.length);
  const fishCount = recipes.filter((r) => r.fish).length;

  return (
    <>
      <header className="top">
        <div className="titleblock">
          <p className="eyebrow">Recipe bank · Mediterranean · Persian · Asian · Mexican</p>
          <h1>The Weekly Table</h1>
          <p>Fresh, from-scratch dinners for menu and grocery planning — no ultra-processed shortcuts, fish worked in weekly, and nothing overly calorific. Filter by cuisine or protein, then build a shopping list.</p>
        </div>
        <div className="headline-stats">
          <div><span className="n">{recipes.length}</span><span className="l">Recipes</span></div>
          <div><span className="n">{fishCount}</span><span className="l">Fish dishes</span></div>
          <div><span className="n">{avgTime}</span><span className="l">Avg. min</span></div>
        </div>
      </header>

      <FilterBar
        filters={filters}
        onToggleCuisine={(c) => toggleSet("cuisine", c)}
        onToggleProtein={(p) => toggleSet("protein", p)}
        onSetTime={(t) => setFilters((prev) => ({ ...prev, time: prev.time === t ? null : t }))}
        onSearch={(v) => setFilters((prev) => ({ ...prev, search: v }))}
        onReset={() => setFilters(INITIAL_FILTERS)}
      />

      <p id="count">Showing {filtered.length} of {recipes.length} recipes</p>

      {filtered.length === 0 ? (
        <div className="noresults">No recipes match those filters — try clearing one.</div>
      ) : (
        <div className="grid">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </>
  );
}
