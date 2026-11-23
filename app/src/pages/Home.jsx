import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useShopping } from "../context/ShoppingContext";
import { weekLabel } from "../lib/weeklyMenu";
import RecipeCard from "../components/RecipeCard";
import FilterBar from "../components/FilterBar";
import { matchesCookingMethod } from "../lib/recipeFilters";

const INITIAL_FILTERS = { cuisine: new Set(), protein: new Set(), time: null, search: "", cookingMethod: "" };

export default function Home({ recipes }) {
  const { week } = useShopping();
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("weeklyTableRecipeFilters"));
      if (saved) return { ...INITIAL_FILTERS, ...saved, cuisine: new Set(saved.cuisine), protein: new Set(saved.protein) };
    } catch { /* Filters are optional. */ }
    return INITIAL_FILTERS;
  });
  useEffect(() => {
    try { sessionStorage.setItem("weeklyTableRecipeFilters", JSON.stringify({ ...filters, cuisine: [...filters.cuisine], protein: [...filters.protein] })); } catch { /* Filters are optional. */ }
  }, [filters]);

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (!matchesCookingMethod(r, filters.cookingMethod)) return false;
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

  return (
    <>
      <header className="top">
        <div className="titleblock">
          <p className="eyebrow">Recipe bank</p>
          <h1>Find a meal</h1>
          <p>Open a recipe to take a look, or add it straight to your menu.</p>
          <p className="planning-week">Adding to <strong>{weekLabel(week)}</strong> · <Link to="/week?view=menu">Change week</Link></p>
        </div>
      </header>

      <FilterBar
        filters={filters}
        onToggleCuisine={(c) => toggleSet("cuisine", c)}
        onToggleProtein={(p) => toggleSet("protein", p)}
        onSetCookingMethod={(cookingMethod) => setFilters((prev) => ({ ...prev, cookingMethod }))}
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
