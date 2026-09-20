import { useState } from "react";
import { imageUrl } from "../lib/github";
import { CUISINE_COLOR } from "../lib/constants";

const CUISINE_ICON = {
  Mediterranean: "🫒",
  Persian: "🌿",
  Asian: "🥢",
  Mexican: "🌶️",
};

export default function RecipeImage({ recipe, className = "" }) {
  const [failed, setFailed] = useState(false);
  const color = CUISINE_COLOR[recipe.cuisine];

  if (failed || !recipe.image) {
    return (
      <div
        className={`recipe-image placeholder ${className}`}
        style={{ background: `linear-gradient(155deg, var(--${color}-soft), var(--${color}))` }}
        role="img"
        aria-label={recipe.title}
      >
        <span className="placeholder-icon">{CUISINE_ICON[recipe.cuisine] || "🍽️"}</span>
      </div>
    );
  }

  return (
    <img
      className={`recipe-image ${className}`}
      src={imageUrl(recipe.image)}
      alt={recipe.title}
      onError={() => setFailed(true)}
    />
  );
}
