import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { restorePlan } from "../lib/weekPlan";
import { createPlannerSync } from "../lib/plannerSync";

const ShoppingContext = createContext(null);
export function ShoppingProvider({ children }) {
  const [sync] = useState(() => {
    const store = createPlannerSync({ storage: { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) } });
    try { store.changeWeek(sessionStorage.getItem("weeklyTableViewedWeek")); } catch { /* Start on this week. */ }
    return store;
  });
  const { planner, status, storageFailed, pending } = useSyncExternalStore(sync.subscribe, sync.getSnapshot);
  const { selected, completed } = planner.weeks[planner.week] || restorePlan(null);
  useEffect(() => {
    sync.start();
    const refresh = () => { if (document.visibilityState === "visible") void sync.refresh(); };
    const interval = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { sync.stop(); clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [sync]);
  useEffect(() => { try { sessionStorage.setItem("weeklyTableViewedWeek", planner.week); } catch { /* Viewing preferences are optional. */ } }, [planner.week]);
  const message = status === "loading" ? "Checking your household menu…" : status === "saving" ? "Saving your household menu…"
    : status === "signed-out" ? "Sign in again to sync this device. Your changes are kept here."
    : status === "offline" ? (pending ? "Changes saved on this device. They’ll sync when the connection returns." : "Showing your saved menu. Reconnecting to your household…")
    : "Household menu synced across your devices.";
  return <ShoppingContext.Provider value={{
    selected, completed, week: planner.week, weeks: planner.weeks,
    toggle: (id) => sync.dispatch({ type: "toggle", id }),
    selectMeal: (id, value) => sync.dispatch({ type: "select", id, value }),
    restoreMeals: (ids, cooked) => {
      sync.dispatch({ type: "replace", ids });
      for (const id of cooked) if (ids.includes(id)) sync.dispatch({ type: "complete", id, value: true });
    },
    clear: () => sync.dispatch({ type: "clear" }),
    toggleCompleted: (id) => sync.dispatch({ type: "complete", id }),
    changeWeek: sync.changeWeek,
    setMeals: (ids, keepCooked = false) => {
      if (!keepCooked) { sync.dispatch({ type: "replace", ids }); return; }
      // Finish a partially chosen draft without resetting its existing cooked ticks.
      for (const id of selected) if (!ids.includes(id)) sync.dispatch({ type: "select", id, value: false });
      for (const id of ids) if (!selected.has(id)) sync.dispatch({ type: "select", id, value: true });
    },
    swapMeal: (id, replacement) => sync.dispatch({ type: "swap", id, replacement }),
  }}>
    <p className={`household-sync ${status === "offline" || status === "signed-out" ? "sync-pending" : ""}`} role="status">{message} {status === "signed-out" ? <a href="/auth/login">Sign in</a> : status === "offline" && <button type="button" className="week-reset" onClick={() => void sync.refresh()}>Retry now</button>}</p>
    {storageFailed && <p className="storage-warning" role="status">This browser couldn’t save a backup. Keep this tab open until your menu has synced.</p>}
    {children}
  </ShoppingContext.Provider>;
}
export function useShopping() {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error("useShopping must be used within ShoppingProvider");
  return ctx;
}
