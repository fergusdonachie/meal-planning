import { useEffect } from "react";
import { useShopping } from "../context/ShoppingContext";
import { CUISINE_COLOR } from "../lib/constants";

export default function ShoppingListModal({ recipes, onClose }) {
  const { selected } = useShopping();
  const items = [...selected].map((id) => recipes.find((r) => r.id === id)).filter(Boolean);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button type="button" className="close-btn" aria-label="Close" onClick={onClose}>×</button>
        <h2>This week's shopping list</h2>
        <p className="sub">
          {items.length
            ? `Ingredients for ${items.length} recipe${items.length > 1 ? "s" : ""}, grouped by dish — quantities assume 2 servings each.`
            : ""}
        </p>
        {items.length === 0 ? (
          <p className="empty">Nothing selected yet. Add a few meals from the bank first.</p>
        ) : (
          items.map((r) => (
            <div className="listgroup" key={r.id}>
              <h4>
                <span style={{ color: `var(--${CUISINE_COLOR[r.cuisine]})` }}>●</span> {r.title}
              </h4>
              <ul>
                {r.ingredients.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
