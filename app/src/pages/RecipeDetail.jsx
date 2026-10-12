import { Link, useParams } from "react-router-dom";
import RecipeImage from "../components/RecipeImage";
import SpiceDots from "../components/SpiceDots";
import { useShopping } from "../context/ShoppingContext";
import { CUISINE_COLOR } from "../lib/constants";

export default function RecipeDetail({ recipes }) {
  const { id } = useParams();
  const { selected, completed, toggle, toggleCompleted } = useShopping();
  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <div className="detail-notfound">
        <p>Couldn't find that recipe.</p>
        <Link to="/">← Back to the recipe bank</Link>
      </div>
    );
  }

  const color = CUISINE_COLOR[recipe.cuisine];
  const added = selected.has(recipe.id);

  return (
    <article className="detail">
      <Link to={added ? "/week" : "/"} className="backlink">← {added ? "This week's recipes" : "Back to the recipe bank"}</Link>
      <div className="detail-media">
        <RecipeImage key={recipe.image} recipe={recipe} className="detail-image" />
        {recipe.imageSource === "ai" && <span className="image-credit">AI-generated image</span>}
        <span className="cuisine-tag" style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}>
          {recipe.cuisine}
        </span>
      </div>

      <h1>{recipe.title}</h1>
      <p className="blurb">{recipe.blurb}</p>

      <div className="metarow detail-metarow">
        <span className="m">
          {recipe.fish ? <span className="fish-badge">🐟 Fish</span> : <span className="protein-badge">{recipe.protein}</span>}
        </span>
        <span className="m">⏱ {recipe.time} min</span>
        <span className="m">~{recipe.kcal} kcal</span>
        <span className="m">Serves {recipe.servings}</span>
        <span className="m"><SpiceDots level={recipe.spice} /></span>
      </div>
      <p className="recipe-note">Calories are estimates per serving. Choose plain staples and check ingredient labels for unnecessary additives.</p>

      <button type="button" className={`addbtn detail-addbtn ${added ? "added" : ""}`} onClick={() => toggle(recipe.id)}>
        {added ? "✓ Added to shopping list" : "+ Add to shopping list"}
      </button>
      {added && <label className="cooked-toggle detail-cooked"><input type="checkbox" checked={completed.has(recipe.id)} onChange={() => toggleCompleted(recipe.id)} /> I've cooked this meal</label>}

      <div className="detail-grid">
        <section>
          <h2>Ingredients</h2>
          <ul>
            {recipe.ingredients.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Method</h2>
          <ol>
            {recipe.method.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
