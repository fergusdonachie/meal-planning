import { CUISINES, PROTEINS } from "../lib/constants";
import { useState } from "react";

const TIME_OPTIONS = [
  { value: 20, label: "≤20 min" },
  { value: 35, label: "≤35 min" },
  { value: 99, label: "Any time" },
];

export default function FilterBar({ filters, onToggleCuisine, onToggleProtein, onSetTime, onSearch, onReset, onSetCookingMethod }) {
  const [expanded, setExpanded] = useState(false);
  const active = filters.cuisine.size + filters.protein.size + Number(Boolean(filters.time)) + Number(Boolean(filters.cookingMethod));
  return (
    <div className="filterbar">
      <div className="filter-summary">
        <button type="button" className="addbtn" aria-expanded={expanded} aria-controls="recipe-filter-options" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide filters" : "Show filters"}{active > 0 ? ` (${active})` : ""}</button>
        <label className="bank-search"><span className="sr-only">Search recipes</span><input type="search" placeholder="Search ingredient or dish…" value={filters.search} onChange={(event) => onSearch(event.target.value)} /></label>
        {(active > 0 || filters.search) && <button type="button" className="resetbtn compact-reset" aria-label="Reset filters" onClick={onReset}>Reset</button>}
      </div>
      <div id="recipe-filter-options" hidden={!expanded}>
      <div className="filterrow">
        <label className="cooking-filter">Cooking <select aria-label="Cooking method" value={filters.cookingMethod} onChange={(event) => onSetCookingMethod(event.target.value)}><option value="">Any method</option><option value="single">One pot / one tray</option><option value="One pot">One pot · hob</option><option value="One tray">One tray · oven</option></select></label>
      </div>
      <div className="filterrow">
        <span className="flabel">Cuisine</span>
        {CUISINES.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={filters.cuisine.has(c)}
            onClick={() => onToggleCuisine(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="filterrow">
        <span className="flabel">Protein</span>
        {PROTEINS.map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${p === "Fish" ? "fish" : ""}`}
            aria-pressed={filters.protein.has(p)}
            onClick={() => onToggleProtein(p)}
          >
            {p === "Fish" ? "🐟 Fish" : p}
          </button>
        ))}
      </div>
      <div className="filterrow">
        <span className="flabel">Time</span>
        {TIME_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            className="chip"
            aria-pressed={filters.time === t.value}
            onClick={() => onSetTime(t.value)}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="resetbtn" onClick={onReset}>
          Reset filters
        </button>
      </div>
      </div>
    </div>
  );
}
