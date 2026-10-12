import { useState } from "react";
import { Link } from "react-router-dom";
import RecipeImage from "../components/RecipeImage";
import { useShopping } from "../context/ShoppingContext";

export default function Week({ recipes, onShopping }) {
  const { selected, completed, toggleCompleted, clear } = useShopping();
  const [confirmReset, setConfirmReset] = useState(false);
  const meals = [...selected].map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean);
  const pending = meals.filter((recipe) => !completed.has(recipe.id));
  const cooked = meals.filter((recipe) => completed.has(recipe.id));

  function renderCard(recipe) {
    const done = completed.has(recipe.id);
    return <article className={`card week-card ${done ? "cooked" : ""}`} key={recipe.id}>
      <Link className="card-media-link" to={`/recipe/${recipe.id}`}>
        <RecipeImage recipe={recipe} />
        {recipe.imageSource === "ai" && <span className="image-credit">AI-generated image</span>}
        {done && <span className="cooked-badge">✓ Cooked</span>}
      </Link>
      <div className="card-body">
        <h3><Link to={`/recipe/${recipe.id}`}>{recipe.title}</Link></h3>
        <p className="blurb">{recipe.blurb}</p>
        <p className="week-meta">{recipe.time} min · Serves {recipe.servings} · {recipe.cuisine}</p>
        <div className="week-card-actions">
          <Link className="addbtn cook-link" to={`/recipe/${recipe.id}`}>Open recipe card</Link>
          <label className="cooked-toggle"><input type="checkbox" checked={done} onChange={() => toggleCompleted(recipe.id)} /> Cooked</label>
        </div>
      </div>
    </article>;
  }

  return <>
    <header className="top">
      <div className="titleblock"><p className="eyebrow">Your weekly menu</p><h1>This week's recipes</h1>
        <p>All your chosen dinners in one place. Open a recipe card when you're ready to cook, then tick it off when you're finished.</p>
      </div>
      {meals.length > 0 && <div className="week-progress"><strong>{cooked.length} of {meals.length} cooked</strong>
        <progress value={cooked.length} max={meals.length} aria-label="Meals cooked this week" />
      </div>}
    </header>
    <div className="week-toolbar">
      <Link className="addbtn cook-link" to="/">Choose more meals</Link>
      {meals.length > 0 && <><button type="button" className="addbtn" onClick={onShopping}>Shopping list</button>
        <button type="button" className="week-reset" onClick={() => setConfirmReset(true)}>Start a new week</button></>}
    </div>
    {confirmReset && <div className="week-reset-confirm" role="group" aria-label="Start a new week">
      <p>Clear these meals and their cooked ticks to plan a new week?</p>
      <button type="button" className="addbtn" onClick={() => { clear(); setConfirmReset(false); }}>Start fresh</button>
      <button type="button" className="week-reset" onClick={() => setConfirmReset(false)}>Keep this week</button>
    </div>}
    {!meals.length && <div className="noresults">Your week is ready to plan. <Link to="/">Choose dinners from the recipe bank</Link> to see your recipe cards here.</div>}
    {meals.length > 0 && !pending.length && <p className="week-success" role="status">All your dinners are cooked. Ready for next week's menu?</p>}
    {pending.length > 0 && <section aria-labelledby="pending-meals"><h2 id="pending-meals">Still to cook <small>{pending.length}</small></h2><div className="grid">{pending.map(renderCard)}</div></section>}
    {cooked.length > 0 && <section className="cooked-meals" aria-labelledby="cooked-meals"><h2 id="cooked-meals">Cooked this week <small>{cooked.length}</small></h2><div className="grid">{cooked.map(renderCard)}</div></section>}
    <p className="recipe-note">Your menu and cooked ticks are saved on this device. They don't sync between phones yet.</p>
  </>;
}
