import { useEffect, useState } from "react";
import { RECIPES_URL } from "../lib/github";

export function useRecipes() {
  const [state, setState] = useState({ recipes: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ recipes: null, error: null, loading: true });

    fetch(RECIPES_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
        return res.json();
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
