import { Link, useParams, useSearchParams } from "react-router-dom";
import CookingCard from "../components/CookingCard";
import RecipeImage from "../components/RecipeImage";
import SpiceDots from "../components/SpiceDots";
import { useShopping } from "../context/ShoppingContext";
import { CUISINE_COLOR } from "../lib/constants";

export default function RecipeDetail({ recipes }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { week, selected, completed, toggle, toggleCompleted } = useShopping();
  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <div className="detail-notfound">
        <p>Couldn't find that recipe.</p>
        <Link to="/recipes">← Back to the recipe bank</Link>
      </div>
    );
  }

  if (searchParams.get("cook") === "1") return <CookingCard key={`${week}:${recipe.id}`} recipe={recipe} onClose={() => { const next = new URLSearchParams(searchParams); next.delete("cook"); setSearchParams(next); }} />;

  const color = CUISINE_COLOR[recipe.cuisine];
  const added = selected.has(recipe.id);
  const fromSuggestions = searchParams.get("from") === "suggestions";
  const suggestionCount = searchParams.get("count") === "4" ? 4 : 5;

  return (
    <article className="detail">
      <Link to={fromSuggestions || added ? "/week" : "/recipes"} className="backlink">← {fromSuggestions ? `Back to the ${suggestionCount} suggestions` : added ? "This week's recipes" : "Back to the recipe bank"}</Link>
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
        {recipe.cookingMethod && <span className="m">{recipe.cookingMethod} · {recipe.cookingMethod === "One pot" ? "Hob" : "Oven"}</span>}
        <span className="m"><SpiceDots level={recipe.spice} /></span>
      </div>
      <p className="recipe-note">Calories are estimates per serving. Choose plain staples and check ingredient labels for unnecessary additives.</p>

      <button type="button" className={`addbtn detail-addbtn ${added ? "added" : ""}`} onClick={() => toggle(recipe.id)}>
        {added ? "✓ In this week's menu" : "+ Add to this week"}
      </button>
      {added && <label className="cooked-toggle detail-cooked"><input type="checkbox" checked={completed.has(recipe.id)} onChange={() => toggleCompleted(recipe.id)} /> I've cooked this meal</label>}

      {fromSuggestions && <p><Link to="/week">Continue choosing from your {suggestionCount} suggestions →</Link></p>}
      <div className="recipe-card-actions"><button type="button" className="primary-action" onClick={() => { const next = new URLSearchParams(searchParams); next.set("cook", "1"); setSearchParams(next); }}>Start cooking →</button><button type="button" className="addbtn" onClick={() => window.print()}>Print recipe card</button></div>

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
