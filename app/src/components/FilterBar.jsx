import { CUISINES, PROTEINS } from "../lib/constants";

const TIME_OPTIONS = [
  { value: 20, label: "≤20 min" },
  { value: 35, label: "≤35 min" },
  { value: 99, label: "Any time" },
];

export default function FilterBar({ filters, onToggleCuisine, onToggleProtein, onSetTime, onSearch, onReset }) {
  return (
    <div className="filterbar">
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
        <div className="searchwrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search ingredient or dish…"
            value={filters.search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <button type="button" className="resetbtn" onClick={onReset}>
          Reset filters
        </button>
      </div>
    </div>
  );
}
