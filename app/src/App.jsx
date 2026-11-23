import { useLayoutEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import { useRecipes } from "./hooks/useRecipes";
import { ShoppingProvider } from "./context/ShoppingContext";
import ShoppingBar from "./components/ShoppingBar";
import ShoppingListModal from "./components/ShoppingListModal";
import Home from "./pages/Home";
import RecipeDetail from "./pages/RecipeDetail";
import Week from "./pages/Week";
import AppNavigation from "./components/AppNavigation";
import { RECIPES_URL } from "./lib/github";

export default function App() {
  const { recipes, error, loading } = useRecipes();
  const location = useLocation();
  const cooking = location.pathname.startsWith("/recipe/") && new URLSearchParams(location.search).get("cook") === "1";
  const [modalOpen, setModalOpen] = useState(false);
  const scrollPositions = useRef(new Map());
  useLayoutEffect(() => {
    const key = location.pathname + location.search;
    const browsing = location.pathname === "/week" || location.pathname === "/recipes";
    window.scrollTo(0, browsing ? scrollPositions.current.get(key) || 0 : 0);
    const remember = () => scrollPositions.current.set(key, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [location.pathname, location.search, loading]);

  if (loading) {
    return (
      <div className="wrap">
        <p className="statusmsg">Loading recipes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrap">
        <p className="statusmsg error">
          Couldn't load the recipe bank from GitHub ({error.message}).
          <br />
          Trying to fetch <code>{RECIPES_URL}</code> — check the repo is public and the file exists on this branch.
        </p>
      </div>
    );
  }

  return (
    <ShoppingProvider>
      <div className="wrap">
        {!cooking && <AppNavigation onShopping={() => setModalOpen(true)} />}
        <Routes>
          <Route path="/" element={<Navigate to="/week" replace />} />
          <Route path="/recipes" element={<Home recipes={recipes} />} />
          <Route path="/week" element={<Week recipes={recipes} onShopping={() => setModalOpen(true)} />} />
          <Route path="/recipe/:id" element={<RecipeDetail recipes={recipes} />} />
        </Routes>
        {!cooking && <footer className="app-footer"><span>The Weekly Table · Your household</span>{import.meta.env.PROD && <form action="/auth/logout" method="post" className="logout-form"><button type="submit">Sign out</button></form>}</footer>}
      </div>
      {!cooking && <ShoppingBar onView={() => setModalOpen(true)} />}
      {modalOpen && <ShoppingListModal recipes={recipes} onClose={() => setModalOpen(false)} />}
    </ShoppingProvider>
  );
}
