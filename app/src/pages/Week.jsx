import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RecipeImage from "../components/RecipeImage";
import { useShopping } from "../context/ShoppingContext";
import { currentWeek, shiftWeek, suggestMeals, weekLabel } from "../lib/weeklyMenu";
import { matchesCookingMethod } from "../lib/recipeFilters";

export default function Week({ recipes }) {
  const { week } = useShopping();
  return <WeekView key={week} recipes={recipes} />;
}

function WeekView({ recipes }) {
  const { selected, completed, toggleCompleted, clear, week, weeks, changeWeek, setMeals, swapMeal, selectMeal, restoreMeals } = useShopping();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get("view");
  const view = ["menu", "ideas"].includes(requestedView) ? requestedView : selected.size ? "menu" : "ideas";
  function showView(next) { setParams({ view: next }, { replace: true }); }
  const draftKey = `weeklyTableSuggestions:${week}`;
  function buildDraft(options) {
    const pool = recipes.filter((recipe) => matchesCookingMethod(recipe, options.onePan ? "single" : ""));
    return { ...options, ids: suggestMeals(pool, week, options.count, [...(weeks[shiftWeek(week, -1)]?.selected || [])], options.variation) };
  }
  const [draft, setDraft] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey));
      if ([4, 5].includes(saved?.count) && Array.isArray(saved.ids) && saved.ids.length && saved.ids.every((id) => recipes.some((recipe) => recipe.id === id))) return saved;
    } catch { /* Start a new draft if browser storage is unavailable. */ }
    return buildDraft({ count: 5, variation: 0, onePan: false });
  });
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* Navigation still works without saved suggestions. */ } }, [draftKey, draft]);
  const { count, onePan, ids: suggestions } = draft;
  function changeSuggestions(changes) { setDraft((previous) => buildDraft({ ...previous, ...changes })); }
  const [swapping, setSwapping] = useState(null);
  const [replacement, setReplacement] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  function removeRecipe(recipe) {
    showView(view);
    setUndo({ ids: [recipe.id], cooked: completed.has(recipe.id) ? [recipe.id] : [], kind: "remove" });
    selectMeal(recipe.id, false);
    setNotice(`${recipe.title} removed from your menu.`);
  }
  function acceptIdeas() {
    setUndo({ ids: [...selected], cooked: [...completed], kind: "reset" });
    setMeals(suggestions, true);
    setConfirmReplace(false);
    showView("menu");
    setNotice("Menu ready. Your shopping list includes these meals.");
  }
  function undoChange() {
    if (undo.kind === "remove") restoreMeals([...selected, ...undo.ids], [...completed, ...undo.cooked]);
    else restoreMeals(undo.ids, undo.cooked);
    setUndo(null); setNotice("Your menu has been restored.");
  }
  const meals = [...selected].map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean);
  const pending = meals.filter((recipe) => !completed.has(recipe.id));
  const cooked = meals.filter((recipe) => completed.has(recipe.id));
  const preview = suggestions.map((id) => recipes.find((recipe) => recipe.id === id));
  const swapOptions = recipes.filter((recipe) => !selected.has(recipe.id) && matchesCookingMethod(recipe, onePan ? "single" : "")).sort((a, b) => {
    const original = recipes.find((recipe) => recipe.id === swapping);
    return Number(b.protein === original?.protein) - Number(a.protein === original?.protein) || a.time - b.time || a.title.localeCompare(b.title);
  });

  function navigateWeek(next) { setParams({}, { replace: true }); changeWeek(next); }
  function renderCard(recipe) {
    const done = completed.has(recipe.id);
    return <article className={`card week-card ${done ? "cooked" : ""}`} key={recipe.id}>
      <Link className="card-media-link" to={`/recipe/${recipe.id}?from=week`}>
        <RecipeImage recipe={recipe} />
        {recipe.imageSource === "ai" && <span className="image-credit">AI-generated image</span>}
        {done && <span className="cooked-badge">✓ Cooked</span>}
      </Link>
      <div className="card-body">
        <h3><Link to={`/recipe/${recipe.id}?from=week`}>{recipe.title}</Link></h3>
        <p className="blurb">{recipe.blurb}</p>
        <p className="week-meta">{recipe.time} min · Serves {recipe.servings} · {recipe.cuisine}</p>
        <div className="week-card-actions">
          <Link className="addbtn cook-link" to={`/recipe/${recipe.id}?from=week&cook=1`}>Start cooking</Link>
          {!done && <button type="button" className="week-reset" onClick={() => { setSwapping(swapping === recipe.id ? null : recipe.id); setReplacement(""); }}>Swap meal</button>}
          <button type="button" className="week-reset" onClick={() => removeRecipe(recipe)}>Remove<span className="sr-only"> {recipe.title}</span></button>
          <label className="cooked-toggle"><input type="checkbox" checked={done} onChange={() => toggleCompleted(recipe.id)} /> Cooked</label>
        </div>
        {swapping === recipe.id && <div className="swap-picker">
          <label htmlFor={`swap-${recipe.id}`}>Choose a replacement</label>
          <select id={`swap-${recipe.id}`} value={replacement} onChange={(event) => setReplacement(event.target.value)}>
            <option value="" disabled>Select a recipe…</option>
            {swapOptions.map((option) => <option key={option.id} value={option.id}>{option.title} · {option.time} min · {option.protein}</option>)}
          </select>
          <div className="swap-actions"><button type="button" className="addbtn" disabled={!replacement} onClick={() => {
            swapMeal(recipe.id, replacement); setSwapping(null); setUndo(null); setNotice("Meal swapped. Your shopping list has been updated.");
          }}>Swap this meal</button><button type="button" className="week-reset" onClick={() => setSwapping(null)}>Cancel</button></div>
        </div>}
      </div>
    </article>;
  }

  return <>
    <header className="top week-heading">
      <div className="titleblock"><h1>Your weekly menu</h1></div>
      {view === "menu" && meals.length > 0 && <div className="week-progress"><strong>{cooked.length} of {meals.length} cooked</strong><progress value={cooked.length} max={meals.length} aria-label="Meals cooked this week" /></div>}
    </header>
    <div className="week-calendar" aria-label="Choose a week">
      <button type="button" className="addbtn" onClick={() => navigateWeek(shiftWeek(week, -1))} aria-label="Previous week">←</button>
      <strong>{weekLabel(week)}</strong>
      <button type="button" className="addbtn" onClick={() => navigateWeek(shiftWeek(week, 1))} aria-label="Next week">→</button>
      {week !== currentWeek() && <button type="button" className="week-reset" onClick={() => navigateWeek(currentWeek())}>Back to this week</button>}
    </div>
    <nav className="weekly-views" aria-label="Weekly views">
      <Link to="/week?view=menu" aria-current={view === "menu" ? "page" : undefined}>Your menu <span>{meals.length}</span></Link>
      <Link to="/week?view=ideas" aria-current={view === "ideas" ? "page" : undefined}>Meal ideas</Link>
    </nav>
    <div className="menu-feedback" role="status" hidden={!notice}>{notice} {undo && <button type="button" className="week-reset" onClick={undoChange}>Undo</button>}</div>
    {view === "ideas" ? <section className="menu-proposal" aria-labelledby="suggested-menu">
      <div className="proposal-heading"><div><h2 id="suggested-menu">Pick meals for your week</h2><p>Add meals individually, or use the whole set.</p></div>
        <label>Suggest <select value={count} onChange={(event) => { setConfirmReplace(false); changeSuggestions({ count: Number(event.target.value) }); }}><option value={4}>4 meals</option><option value={5}>5 meals</option></select></label>
      </div>
      <label className="single-vessel-choice"><input type="checkbox" checked={onePan} onChange={(event) => { setConfirmReplace(false); changeSuggestions({ onePan: event.target.checked }); }} /> One pot / one tray only</label>
      <ol className="suggested-meals">{preview.map((recipe) => <li key={recipe.id}>
        <Link to={`/recipe/${recipe.id}?from=suggestions`} tabIndex={-1} aria-hidden="true"><RecipeImage recipe={recipe} className="suggestion-photo" /></Link>
        <div className="suggestion-info"><Link to={`/recipe/${recipe.id}?from=suggestions`}>{recipe.title}</Link><small>{recipe.time} min · {recipe.protein} · {recipe.cookingMethod || recipe.cuisine}</small><Link className="recipe-preview" to={`/recipe/${recipe.id}?from=suggestions`}>View recipe</Link></div>
        {selected.has(recipe.id) ? <div className="suggestion-choice"><span className="menu-membership">✓ In your menu</span><button type="button" className="week-reset" onClick={() => removeRecipe(recipe)}>Remove<span className="sr-only"> {recipe.title}</span></button></div> : <button type="button" className="addbtn" onClick={() => { showView("ideas"); selectMeal(recipe.id, true); setNotice(`${recipe.title} added to your menu.`); setUndo(null); }}>Add to week<span className="sr-only">: {recipe.title}</span></button>}
      </li>)}</ol>
      <div className="shopping-actions"><button type="button" className="primary-action" onClick={() => { if ([...selected].some((id) => !suggestions.includes(id))) setConfirmReplace(true); else acceptIdeas(); }}>Use all {preview.length} meals</button>
        <button type="button" className="addbtn" onClick={() => { setConfirmReplace(false); changeSuggestions({ variation: draft.variation + 1 }); }}>Show other ideas</button></div>
      {confirmReplace && <div className="week-reset-confirm" role="group" aria-label="Replace menu">
        <p>Replace the menu for {weekLabel(week)} with these {preview.length} meals? Cooked ticks stay for any meals you keep.</p>
        <button type="button" className="addbtn" onClick={acceptIdeas}>Replace menu</button><button type="button" className="week-reset" onClick={() => setConfirmReplace(false)}>Keep my menu</button>
      </div>}
      <p className="recipe-note">Recipe images are AI-generated.</p>
      <p className="ideas-footer">Want something else? <Link to="/recipes">Browse all {recipes.length} recipes →</Link></p>
    </section> : <>
      <div className="week-toolbar">
        <Link className="addbtn" to="/week?view=ideas">Add meal ideas</Link>
        <Link className="addbtn" to="/recipes">Browse recipes</Link>
        {meals.length > 0 && <button type="button" className="week-reset" onClick={() => setConfirmReset(true)}>Reset week</button>}
      </div>
      {confirmReset && <div className="week-reset-confirm" role="group" aria-label="Reset week">
        <p>Remove all meals and cooked ticks for {weekLabel(week)}? Other weeks stay saved.</p>
        <button type="button" className="addbtn" onClick={() => { setUndo({ ids: [...selected], cooked: [...completed], kind: "reset" }); clear(); setConfirmReset(false); setNotice("Week reset. Choose new meals, or undo to restore your menu."); }}>Reset this week</button>
        <button type="button" className="week-reset" onClick={() => setConfirmReset(false)}>Keep menu</button>
      </div>}
      {!meals.length && <section className="menu-empty"><h2>No meals chosen yet</h2><p>Start with four or five ideas, or choose your own from the recipe bank.</p><Link className="primary-action" to="/week?view=ideas">Choose meal ideas →</Link></section>}
      {meals.length > 0 && !pending.length && <p className="week-success">All your dinners are cooked. <button type="button" className="week-reset" onClick={() => navigateWeek(shiftWeek(week, 1))}>Plan next week →</button></p>}
      {pending.length > 0 && <section aria-labelledby="pending-meals"><h2 id="pending-meals">Ready to cook <small>{pending.length}</small></h2><div className="grid">{pending.map(renderCard)}</div></section>}
      {cooked.length > 0 && <section className="cooked-meals" aria-labelledby="cooked-meals"><h2 id="cooked-meals">Cooked <small>{cooked.length}</small></h2><div className="grid">{cooked.map(renderCard)}</div></section>}
    </>}
  </>;
}
