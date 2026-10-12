import { useEffect, useState } from "react";
import { LOCAL_RECIPES_URL, RECIPES_URL } from "../lib/github";

export function useRecipes() {
  const [state, setState] = useState({ recipes: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function readRecipes(url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Recipe request returned ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error("The recipe bank is empty or invalid");
      return data;
    }

    readRecipes(RECIPES_URL)
      .catch((err) => {
        if (RECIPES_URL === LOCAL_RECIPES_URL) throw err;
        return readRecipes(LOCAL_RECIPES_URL);
      })
      .then((data) => {
        if (!cancelled) setState({ recipes: data, error: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) setState({ recipes: null, error: err, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
