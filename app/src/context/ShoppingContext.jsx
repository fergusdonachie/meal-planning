import { createContext, useContext, useEffect, useReducer, useState } from "react";
import { validWeek } from "../lib/weeklyMenu";
import { PLAN_STORAGE_KEY, restorePlan } from "../lib/weekPlan";
import { PLANNER_KEY, restorePlanner, serializePlanner, updatePlanner } from "../lib/weeklyPlanner";

const ShoppingContext = createContext(null);
function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function loadSaved() {
  const saved = readSaved(PLANNER_KEY, null);
  const oldPlan = readSaved(PLAN_STORAGE_KEY, null);
  const legacy = readSaved("weeklyTableSelected", []);
  const planner = restorePlanner(saved, oldPlan || { selected: legacy });
  try {
    const viewed = sessionStorage.getItem("weeklyTableViewedWeek");
    return validWeek(viewed) ? { ...planner, week: viewed } : planner;
  } catch { return planner; }
}

export function ShoppingProvider({ children }) {
  const [planner, dispatch] = useReducer(updatePlanner, null, loadSaved);
  const [storageFailed, setStorageFailed] = useState(false);
  const { selected, completed } = planner.weeks[planner.week] || restorePlan(null);
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Report a failure from the external storage system.
    try { localStorage.setItem(PLANNER_KEY, JSON.stringify(serializePlanner(planner))); } catch { setStorageFailed(true); }
    try { sessionStorage.setItem("weeklyTableViewedWeek", planner.week); } catch { /* The saved menu is still available in local storage. */ }
  }, [planner]);
  return <ShoppingContext.Provider value={{
    selected, completed, week: planner.week, weeks: planner.weeks,
    toggle: (id) => dispatch({ type: "toggle", id }),
    clear: () => dispatch({ type: "clear" }),
    toggleCompleted: (id) => dispatch({ type: "complete", id }),
    changeWeek: (week) => dispatch({ type: "week", week }),
    setMeals: (ids) => dispatch({ type: "replace", ids }),
    swapMeal: (id, replacement) => dispatch({ type: "swap", id, replacement }),
  }}>{storageFailed && <p className="storage-warning" role="status">This browser had trouble saving your menu. Keep this tab open; changes may be lost when you close it.</p>}{children}</ShoppingContext.Provider>;
}
export function useShopping() {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error("useShopping must be used within ShoppingProvider");
  return ctx;
}
