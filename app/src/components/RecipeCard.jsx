import { Link } from "react-router-dom";
import RecipeImage from "./RecipeImage";
import SpiceDots from "./SpiceDots";
import { useShopping } from "../context/ShoppingContext";
import { CUISINE_COLOR } from "../lib/constants";

export default function RecipeCard({ recipe }) {
  const { selected, toggle } = useShopping();
  const color = CUISINE_COLOR[recipe.cuisine];
  const added = selected.has(recipe.id);

  return (
    <article className="card">
      <Link to={`/recipe/${recipe.id}`} className="card-media-link">
        <RecipeImage recipe={recipe} className="card-media" />
        <span className="cuisine-tag" style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}>
          {recipe.cuisine}
        </span>
      </Link>
      <div className="card-body">
        <h3>
          <Link to={`/recipe/${recipe.id}`}>{recipe.title}</Link>
        </h3>
        <p className="blurb">{recipe.blurb}</p>
        <div className="metarow">
          <span className="m">
            {recipe.fish ? <span className="fish-badge">🐟 Fish</span> : <span className="protein-badge">{recipe.protein}</span>}
          </span>
          <span className="m">⏱ {recipe.time} min</span>
          <span className="m">{recipe.kcal} kcal</span>
          <span className="m"><SpiceDots level={recipe.spice} /></span>
        </div>
        <div className="addrow">
          <button
            type="button"
            className={`addbtn ${added ? "added" : ""}`}
            onClick={() => toggle(recipe.id)}
          >
            {added ? "✓ Added to list" : "+ Add to shopping list"}
          </button>
        </div>
      </div>
    </article>
  );
}
