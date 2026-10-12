import { createContext, useContext, useEffect, useReducer } from "react";
import { PLAN_STORAGE_KEY, restorePlan, updatePlan } from "../lib/weekPlan";

const STORAGE_KEY = "weeklyTableSelected";
const ShoppingContext = createContext(null);

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || "null");
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return restorePlan(saved, legacy);
  } catch {
    return restorePlan(null);
  }
}

export function ShoppingProvider({ children }) {
  const [plan, dispatch] = useReducer(updatePlan, null, loadSaved);
  const { selected, completed } = plan;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ selected: [...selected], completed: [...completed] }));
    } catch {
      // localStorage unavailable (private mode etc.) — selection just won't persist
    }
  }, [selected, completed]);

  function toggle(id) {
    dispatch({ type: "toggle", id });
  }

  function clear() {
    dispatch({ type: "clear" });
  }

  return (
    <ShoppingContext.Provider value={{ selected, completed, toggle, clear, toggleCompleted: (id) => dispatch({ type: "complete", id }) }}>
      {children}
    </ShoppingContext.Provider>
  );
}

export function useShopping() {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error("useShopping must be used within ShoppingProvider");
  return ctx;
}
