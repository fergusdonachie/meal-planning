import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RecipeImage from "../components/RecipeImage";
import { useShopping } from "../context/ShoppingContext";
import { currentWeek, shiftWeek, suggestMeals, weekLabel } from "../lib/weeklyMenu";
import { matchesCookingMethod } from "../lib/recipeFilters";

export default function Week({ recipes, onShopping }) {
  const { week } = useShopping();
  return <WeekView key={week} recipes={recipes} onShopping={onShopping} />;
}

function WeekView({ recipes, onShopping }) {
  const { selected, completed, toggleCompleted, clear, week, weeks, changeWeek, setMeals, swapMeal } = useShopping();
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
    return buildDraft({ count: 5, variation: 0, onePan: false, open: false, replace: false });
  });
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* Navigation still works without saved suggestions. */ } }, [draftKey, draft]);
  const { count, onePan, ids: suggestions, open: proposing } = draft;
  function setProposing(open) { setDraft((previous) => ({ ...previous, open, replace: open ? selected.size > 0 : previous.replace })); }
  function changeSuggestions(changes) { setDraft((previous) => buildDraft({ ...previous, ...changes })); }
  function openSuggestion() {
    const next = { ...draft, open: true };
    // Persist before Link navigation unmounts this screen and cancels its effect.
    try { sessionStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* Optional browser storage. */ }
    setDraft(next);
  }
  const [swapping, setSwapping] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const meals = [...selected].map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean);
  const pending = meals.filter((recipe) => !completed.has(recipe.id));
  const cooked = meals.filter((recipe) => completed.has(recipe.id));
  const preview = suggestions.map((id) => recipes.find((recipe) => recipe.id === id));
  const swapOptions = recipes.filter((recipe) => !selected.has(recipe.id) && matchesCookingMethod(recipe, onePan ? "single" : "")).sort((a, b) => {
    const original = recipes.find((recipe) => recipe.id === swapping);
    return Number(b.protein === original?.protein) - Number(a.protein === original?.protein) || a.time - b.time || a.title.localeCompare(b.title);
  });

  function navigateWeek(next) { changeWeek(next); }
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
          <Link className="addbtn cook-link" to={`/recipe/${recipe.id}?cook=1`}>Start cooking</Link>
          {!done && <button type="button" className="week-reset" onClick={() => setSwapping(swapping === recipe.id ? null : recipe.id)}>Swap meal</button>}
          <label className="cooked-toggle"><input type="checkbox" checked={done} onChange={() => toggleCompleted(recipe.id)} /> Cooked</label>
        </div>
        {swapping === recipe.id && <div className="swap-picker">
          <label htmlFor={`swap-${recipe.id}`}>Choose a replacement</label>
          <select id={`swap-${recipe.id}`} defaultValue="" onChange={(event) => {
            if (!event.target.value) return;
            swapMeal(recipe.id, event.target.value); setSwapping(null); setNotice("Meal swapped. Your shopping list has been updated.");
          }}>
            <option value="" disabled>Select a recipe…</option>
            {swapOptions.map((option) => <option key={option.id} value={option.id}>{option.title} · {option.time} min · {option.protein}</option>)}
          </select>
          <button type="button" className="week-reset" onClick={() => setSwapping(null)}>Cancel</button>
        </div>}
      </div>
    </article>;
  }

  return <>
    <header className="top">
      <div className="titleblock"><p className="eyebrow">Your household table</p><h1>{week === currentWeek() ? "This week's dinners" : "Your weekly dinners"}</h1>
        <p>Four or five dinners, a little variety, and room to change your mind. Open a cooking card when it's time to eat.</p>
      </div>
      {meals.length > 0 && <div className="week-progress"><strong>{cooked.length} of {meals.length} cooked</strong><progress value={cooked.length} max={meals.length} aria-label="Meals cooked this week" /></div>}
    </header>
    <div className="week-calendar" aria-label="Choose a week">
      <button type="button" className="addbtn" onClick={() => navigateWeek(shiftWeek(week, -1))} aria-label="Previous week">←</button>
      <strong>{weekLabel(week)}</strong>
      <button type="button" className="addbtn" onClick={() => navigateWeek(shiftWeek(week, 1))} aria-label="Next week">→</button>
      {week !== currentWeek() && <button type="button" className="week-reset" onClick={() => navigateWeek(currentWeek())}>Back to this week</button>}
    </div>
    <div className="week-toolbar">
      <Link className="addbtn cook-link" to="/recipes">Browse recipe bank</Link>
      {meals.length > 0 && <>
        <button type="button" className="addbtn" onClick={onShopping}>Shopping list</button>
        <button type="button" className="addbtn" onClick={() => setProposing(!proposing)}>{proposing ? "Keep my menu" : "Suggest a different menu"}</button>
        <button type="button" className="week-reset" onClick={() => setConfirmReset(true)}>Clear this week</button>
      </>}
    </div>
    {confirmReset && <div className="week-reset-confirm" role="group" aria-label="Clear this week">
      <p>Clear this week's meals and cooked ticks? Other weeks stay saved.</p>
      <button type="button" className="addbtn" onClick={() => { clear(); setConfirmReset(false); }}>Clear menu</button>
      <button type="button" className="week-reset" onClick={() => setConfirmReset(false)}>Keep menu</button>
    </div>}
    {(!meals.length || proposing) && <section className="menu-proposal" aria-labelledby="suggested-menu">
      <div className="proposal-heading"><div><p className="eyebrow">A starting point for your week</p><h2 id="suggested-menu">How about these dinners?</h2></div>
        <label>Dinners <select value={count} onChange={(event) => changeSuggestions({ count: Number(event.target.value) })}><option value={4}>4 dinners</option><option value={5}>5 dinners</option></select></label>
      </div>
      <label className="single-vessel-choice"><input type="checkbox" checked={onePan} onChange={(event) => changeSuggestions({ onePan: event.target.checked })} /> One pot / one tray meals only</label>
      <p>{onePan ? "Complete dinners cooked in one pot on the hob or one roasting tray in the oven. Fish, chicken and vegetarian choices where available." : "Fish, chicken and vegetarian choices across the cuisines you enjoy. Suggestions favour meals under 40 minutes and avoid last week's choices where possible."}</p>
      <ol className="suggested-meals">{preview.map((recipe) => <li key={recipe.id}>
        <RecipeImage recipe={recipe} className="suggestion-photo" />
        <div><Link to={`/recipe/${recipe.id}?from=suggestions&count=${count}`} onClick={openSuggestion}>{recipe.title}</Link><small>{recipe.time} min · {recipe.protein} · {recipe.cookingMethod || recipe.cuisine}{selected.has(recipe.id) ? " · ✓ Added to this week" : ""}</small></div>
      </li>)}</ol>
      <p className="recipe-note">Recipe pictures are AI-generated illustrations.</p>
      {meals.length > 0 && draft.replace && <p className="recipe-note">Using these suggestions replaces this week's menu and resets its cooked ticks.</p>}
      <div className="shopping-actions"><button type="button" className="primary-action" onClick={() => { setMeals(suggestions, !draft.replace); setProposing(false); setNotice("Menu saved. You can swap any dinner below."); }}>Use these {preview.length} dinners</button>
        <button type="button" className="addbtn" onClick={() => changeSuggestions({ variation: draft.variation + 1 })}>Try other suggestions</button></div>
    </section>}
    <p role="status" className="shopping-status">{notice}</p>
    {meals.length > 0 && !pending.length && <p className="week-success">All your dinners are cooked. <button type="button" className="week-reset" onClick={() => navigateWeek(shiftWeek(week, 1))}>Plan next week →</button></p>}
    {pending.length > 0 && <section aria-labelledby="pending-meals"><h2 id="pending-meals">Still to cook <small>{pending.length}</small></h2><div className="grid">{pending.map(renderCard)}</div></section>}
    {cooked.length > 0 && <section className="cooked-meals" aria-labelledby="cooked-meals"><h2 id="cooked-meals">Cooked this week <small>{cooked.length}</small></h2><div className="grid">{cooked.map(renderCard)}</div></section>}
    <p className="recipe-note">Your household shares weekly menus and cooked ticks. Updates appear on your other devices when you open the app, or within a few seconds while it’s open.</p>
  </>;
}
