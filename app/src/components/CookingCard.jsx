import { useEffect, useState } from "react";
import { useShopping } from "../context/ShoppingContext";

function restoreProgress(key, recipe) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return { step: Number.isInteger(value?.step) ? Math.max(0, Math.min(value.step, recipe.method.length - 1)) : 0,
      checked: new Set(Array.isArray(value?.checked) ? value.checked.filter((index) => Number.isInteger(index) && index >= 0 && index < recipe.ingredients.length) : []) };
  } catch { return { step: 0, checked: new Set() }; }
}

export default function CookingCard({ recipe, onClose }) {
  const { week, selected, completed, toggleCompleted } = useShopping();
  const storageKey = `weeklyTableCooking:${week}:${recipe.id}`;
  const [progress, setProgress] = useState(() => restoreProgress(storageKey, recipe));
  const [awake, setAwake] = useState(false);
  const [wakeStatus, setWakeStatus] = useState("");
  const { step, checked } = progress;
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ step, checked: [...checked] })); } catch { /* Progress remains available until this card closes. */ }
  }, [storageKey, step, checked]);

  useEffect(() => {
    if (!awake) return;
    let active = true;
    let lock;
    let requesting = false;
    async function acquire() {
      if (!active || requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      if (!navigator.wakeLock) { setWakeStatus("This browser can't keep the screen awake. You can change Auto-Lock in your phone settings."); return; }
      requesting = true;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (!active) { await acquired.release(); return; }
        lock = acquired;
        setWakeStatus("Screen will stay awake while this cooking card is visible.");
        lock.addEventListener("release", () => { if (active) setWakeStatus("Screen-awake paused. It will be requested again when you return to this card."); });
      } catch { if (active) setWakeStatus("Your phone couldn't keep the screen awake. Low Power Mode or browser settings may prevent this."); }
      finally { requesting = false; }
    }
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { active = false; document.removeEventListener("visibilitychange", acquire); lock?.release().catch(() => {}); };
  }, [awake]);

  function toggleIngredient(index) {
    setProgress((previous) => {
      const next = new Set(previous.checked);
      if (next.has(index)) next.delete(index); else next.add(index);
      return { ...previous, checked: next };
    });
  }
  const done = completed.has(recipe.id);
  return <article className="cooking-card">
    <div className="cooking-toolbar"><button type="button" className="addbtn" onClick={onClose}>← Full recipe</button>
      <button type="button" className="addbtn" aria-pressed={awake} onClick={() => { setAwake(!awake); setWakeStatus(""); }}>{awake ? "Stop keeping screen awake" : "Keep screen awake"}</button>
    </div>
    {wakeStatus && <p className="recipe-note" role="status">{wakeStatus}</p>}
    <p className="eyebrow">Cooking together · Serves {recipe.servings} · {recipe.time} min</p>
    <h1>{recipe.title}</h1>
    <div className="cooking-layout">
      <section className="cooking-ingredients" aria-labelledby="cooking-ingredients"><h2 id="cooking-ingredients">Get everything ready</h2><p>Tick ingredients as you prepare them.</p>
        <ul>{recipe.ingredients.map((ingredient, index) => <li key={ingredient} className={checked.has(index) ? "prepared" : ""}>
          <label><input type="checkbox" checked={checked.has(index)} onChange={() => toggleIngredient(index)} /><span>{ingredient}</span></label>
        </li>)}</ul>
      </section>
      <section className="cooking-method" aria-labelledby="current-step">
        <p className="eyebrow" id="current-step">Step {step + 1} of {recipe.method.length}</p>
        <progress value={step + 1} max={recipe.method.length} aria-label="Cooking step" />
        <p className="cooking-instruction" aria-live="polite">{recipe.method[step]}</p>
        <div className="cooking-step-actions">
          <button type="button" className="addbtn" disabled={step === 0} onClick={() => setProgress((previous) => ({ ...previous, step: previous.step - 1 }))}>← Previous</button>
          {step < recipe.method.length - 1
            ? <button type="button" className="primary-action" onClick={() => setProgress((previous) => ({ ...previous, step: previous.step + 1 }))}>Next step →</button>
            : selected.has(recipe.id)
              ? <button type="button" className="primary-action" disabled={done} onClick={() => toggleCompleted(recipe.id)}>{done ? "✓ Meal cooked" : "Finished — mark as cooked"}</button>
              : <p>Enjoy your dinner.</p>}
        </div>
        <p className="recipe-note">Your place is saved for this recipe and week on this device.</p>
        <button type="button" className="week-reset" onClick={() => setProgress({ step: 0, checked: new Set() })}>Reset cooking progress</button>
        <details className="all-steps"><summary>See all steps</summary><ol>{recipe.method.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></details>
      </section>
    </div>
  </article>;
}
