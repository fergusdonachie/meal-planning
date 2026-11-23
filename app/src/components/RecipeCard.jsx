import { Link } from "react-router-dom";
import RecipeImage from "./RecipeImage";
import SpiceDots from "./SpiceDots";
import { useShopping } from "../context/ShoppingContext";
import { CUISINE_COLOR } from "../lib/constants";

export default function RecipeCard({ recipe }) {
  const { selected, selectMeal } = useShopping();
  const color = CUISINE_COLOR[recipe.cuisine];
  const added = selected.has(recipe.id);

  return (
    <article className="card">
      <Link to={`/recipe/${recipe.id}?from=recipes`} className="card-media-link">
        <RecipeImage key={recipe.image} recipe={recipe} className="card-media" />
        {recipe.imageSource === "ai" && <span className="image-credit">AI-generated image</span>}
        <span className="cuisine-tag" style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}>
          {recipe.cuisine}
        </span>
      </Link>
      <div className="card-body">
        <h3>
          <Link to={`/recipe/${recipe.id}?from=recipes`}>{recipe.title}</Link>
        </h3>
        <p className="blurb">{recipe.blurb}</p>
        <div className="metarow">
          <span className="m">
            {recipe.fish ? <span className="fish-badge">🐟 Fish</span> : <span className="protein-badge">{recipe.protein}</span>}
          </span>
          <span className="m">⏱ {recipe.time} min</span>
          {recipe.cookingMethod && <span className="m">{recipe.cookingMethod}</span>}
          <span className="m">~{recipe.kcal} kcal</span>
          <span className="m"><SpiceDots level={recipe.spice} /></span>
        </div>
        <div className="addrow">
          {added ? <><span className="menu-membership">✓ In your menu</span><button type="button" className="week-reset" onClick={() => selectMeal(recipe.id, false)}>Remove<span className="sr-only"> {recipe.title}</span></button></> : <button type="button" className="addbtn" onClick={() => selectMeal(recipe.id, true)}>Add to week<span className="sr-only">: {recipe.title}</span></button>}

        </div>
      </div>
    </article>
  );
}
