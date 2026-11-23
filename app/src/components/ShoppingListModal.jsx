import { useEffect, useRef, useState } from "react";
import { useShopping } from "../context/ShoppingContext";
import { CUISINE_COLOR } from "../lib/constants";
import { ingredientKey, prepareShoppingList } from "../lib/shoppingList";
import { extensionShoppingList, sendShoppingListToExtension, downloadShoppingList } from "../lib/extensionExport";
import { weekLabel } from "../lib/weeklyMenu";
import { STORE_KEY, SUPERMARKETS, getSupermarket, ingredientSearchTerm, supermarketSearchUrl } from "../lib/supermarkets";

const PANTRY_KEY = "weeklyTablePantryExcluded";
function loadExcluded() {
  try {
    const value = JSON.parse(localStorage.getItem(PANTRY_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
  } catch { return new Set(); }
}

export default function ShoppingListModal({ recipes, onClose }) {
  const { selected, week } = useShopping();
  const [excluded, setExcluded] = useState(loadExcluded);
  const [view, setView] = useState("combined");
  const [status, setStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [sending, setSending] = useState(false);
  const [storeId, setStoreId] = useState(() => {
    try { return getSupermarket(localStorage.getItem(STORE_KEY)).id; } catch { return getSupermarket().id; }
  });
  const [query, setQuery] = useState("");
  const store = getSupermarket(storeId);
  const modalRef = useRef(null);
  const copyRef = useRef(null);
  const { items, remaining, combined, sections, allSections, text: listText } = prepareShoppingList(recipes, selected, excluded, view);

  const text = `Week: ${weekLabel(week)}\n${listText}`;

  useEffect(() => {
    try { localStorage.setItem(PANTRY_KEY, JSON.stringify([...excluded])); } catch { /* Storage may be unavailable. */ }
  }, [excluded]);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, storeId); } catch { /* Storage may be unavailable. */ }
  }, [storeId]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector("button")?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = [...modalRef.current.querySelectorAll('button:not(:disabled), a[href], input, textarea, select')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => { if (manualCopy) copyRef.current?.select(); }, [manualCopy]);

  function toggleIngredient(key) {
    setExcluded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setStatus("");
    setManualCopy(false);
  }

  function toggleCombined(entry) {
    const hasNeeded = entry.sources.some((source) => !excluded.has(source.key));
    setExcluded((previous) => {
      const next = new Set(previous);
      for (const source of entry.sources) {
        if (hasNeeded) next.add(source.key);
        else next.delete(source.key);
      }
      return next;
    });
    setStatus("");
    setManualCopy(false);
  }

  function changeView(next) {
    setView(next);
    setStatus("");
    setManualCopy(false);
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Shopping list copied. Open ${store.name} to choose your products.`);
    } catch {
      setManualCopy(true);
      setStatus("Select and copy the list below.");
    }
  }

  async function shareList() {
    if (!navigator.share) return copyList();
    try {
      await navigator.share({ title: "The Weekly Table shopping list", text });
      setStatus("Shopping list shared.");
    } catch (error) {
      if (error.name !== "AbortError") await copyList();
    }
  }

  async function sendToExtension() {
    if (sending) return;
    setSending(true);
    try {
      const result = await sendShoppingListToExtension(extensionShoppingList(sections));
      setStatus(result.ok ? `${result.count} ingredients sent. Open the extension from your browser toolbar, then shop in Morrisons.` : result.error || "The extension could not import the list.");
    } catch {
      setStatus("The extension could not import the list. Try the shopping-list file instead.");
    } finally { setSending(false); }
  }

  return (
    <div className="modal-overlay open" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="shopping-title">
        <button type="button" className="close-btn" aria-label="Close shopping list" onClick={onClose}>×</button>
        <h2 id="shopping-title">Your weekly shopping list</h2>
        <p className="recipe-note">{weekLabel(week)}</p>
        {items.length === 0 ? <p className="empty">Nothing selected yet. Add a few meals from the bank first.</p> : <>
          <p className="sub">{items.length} recipe{items.length === 1 ? "" : "s"} · {view === "combined" ? combined.length : remaining} ingredient entries to buy. Untick anything you already have. Quantities serve {items.every((recipe) => recipe.servings === 2) ? "two per recipe" : "the number shown for each recipe"}.</p>
          <div className="shopping-handoff">
            <h3>Shop your ingredients</h3>
            <label className="supermarket-choice">Your supermarket
              <select value={storeId} onChange={(event) => { setStoreId(event.target.value); setStatus(""); }}>
                {SUPERMARKETS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>
            <p>Use the search link beside each needed ingredient to find it in {store.name}. Check pack sizes against your list, then add products in the shop. Search links don’t transfer a basket.</p>
            <div className="shopping-actions">
              <button type="button" className="addbtn" disabled={!remaining} onClick={copyList}>Copy shopping list</button>
              <button type="button" className="addbtn" disabled={!remaining} onClick={shareList}>Share list</button>
              <a href={store.home} target="_blank" rel="noopener noreferrer">Open {store.name} ↗</a>
            </div>
            <div className="store-search">
              <label htmlFor="store-query">Adjust a search for alternatives or hard-to-find ingredients</label>
              <div className="shopping-actions">
                <input id="store-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. skinless chicken thighs" />
                {query.trim() && <a href={supermarketSearchUrl(storeId, query)} target="_blank" rel="noopener noreferrer">Search {store.name} ↗</a>}
              </div>
            </div>
          </div>
          {storeId === "morrisons" && <div className="extension-handoff">
            <h3>Shop with the Morrisons browser companion</h3>
            <p>On a laptop or PC, send the combined list to the extension to choose products, save favourites and read current product details.</p>
            <div className="shopping-actions">
              <button type="button" className="addbtn" disabled={!remaining || sending} onClick={sendToExtension}>{sending ? "Sending…" : "Send to Morrisons extension"}</button>
              <button type="button" className="addbtn" disabled={!remaining} onClick={() => downloadShoppingList(extensionShoppingList(sections))}>Shopping-list file</button>
              <a href="/downloads/weekly-table-morrisons.zip" download>Download extension ↧</a>
              <a href="/downloads/morrisons-extension-setup.txt" target="_blank" rel="noopener noreferrer">Setup instructions ↗</a>
            </div>
          </div>}
          <p className="shopping-status" role="status">{status}</p>
          {manualCopy && <textarea ref={copyRef} className="copy-list" aria-label="Shopping list to copy" readOnly value={text} rows={8} />}
          <div className="shopping-view" role="group" aria-label="Shopping list view">
            <button type="button" className="addbtn" aria-pressed={view === "combined"} onClick={() => changeView("combined")}>Combined list</button>
            <button type="button" className="addbtn" aria-pressed={view === "recipes"} onClick={() => changeView("recipes")}>By recipe</button>
          </div>
          <p className="recipe-note">{view === "combined" ? "Repeated ingredients are totalled. Different measures stay visible together; alternatives and unclear amounts are kept as written. Tin amounts refer to the labelled tin size." : "Ingredients and quantities for each selected recipe."}</p>
          {remaining === 0 && <p className="empty">Everything is marked as already in your kitchen. Tick an ingredient to add it back.</p>}
          {view === "combined" ? allSections.map((section) => <section className="shopping-section" key={section.id} aria-labelledby={`section-${section.id}`}>
            <h3 id={`section-${section.id}`}>{section.title}</h3>
            <ul className="ingredient-checklist combined-list">
            {section.entries.map((entry) => {
              const needed = combined.find((candidate) => candidate.key === entry.key);
              const included = Boolean(needed);
              const titles = [...new Set(entry.sources.map((source) => source.recipeTitle))];
              return <li key={entry.key} className={included ? "" : "in-pantry"}>
                <label><input type="checkbox" checked={included} onChange={() => toggleCombined(entry)} />
                  <span>{needed?.label || entry.label}<small>{titles.join(" · ")}</small></span>
                </label>
                {included && <a className="ingredient-shop" href={supermarketSearchUrl(storeId, ingredientSearchTerm(needed.name))} target="_blank" rel="noopener noreferrer" aria-label={`Search ${store.name} for ${needed.name}`}>Search ↗</a>}
              </li>;
            })}
            </ul>
          </section>) : items.map((recipe) => (
            <div className="listgroup" key={recipe.id}>
              <h4><span style={{ color: `var(--${CUISINE_COLOR[recipe.cuisine]})` }}>●</span> {recipe.title} <small>Serves {recipe.servings}</small></h4>
              <ul className="ingredient-checklist">
                {recipe.ingredients.map((ingredient) => {
                  const key = ingredientKey(recipe, ingredient);
                  const included = !excluded.has(key);
                  return <li key={ingredient} className={included ? "" : "in-pantry"}>
                    <label><input type="checkbox" checked={included} onChange={() => toggleIngredient(key)} /> <span>{ingredient}</span></label>
                    {included && <a className="ingredient-shop" href={supermarketSearchUrl(storeId, ingredientSearchTerm(ingredient))} target="_blank" rel="noopener noreferrer" aria-label={`Search ${store.name} for ${ingredientSearchTerm(ingredient)}`}>Search ↗</a>}
                  </li>;
                })}
              </ul>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}
