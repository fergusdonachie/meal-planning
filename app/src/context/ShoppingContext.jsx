import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "weeklyTableSelected";
const ShoppingContext = createContext(null);

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(saved);
  } catch {
    return new Set();
  }
}

export function ShoppingProvider({ children }) {
  const [selected, setSelected] = useState(loadSaved);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } catch {
      // localStorage unavailable (private mode etc.) — selection just won't persist
    }
  }, [selected]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return (
    <ShoppingContext.Provider value={{ selected, toggle, clear }}>
      {children}
    </ShoppingContext.Provider>
  );
}

export function useShopping() {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error("useShopping must be used within ShoppingProvider");
  return ctx;
}
