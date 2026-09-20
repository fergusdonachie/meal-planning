import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import { useRecipes } from "./hooks/useRecipes";
import { ShoppingProvider } from "./context/ShoppingContext";
import ShoppingBar from "./components/ShoppingBar";
import ShoppingListModal from "./components/ShoppingListModal";
import Home from "./pages/Home";
import RecipeDetail from "./pages/RecipeDetail";
import { RECIPES_URL } from "./lib/github";

export default function App() {
  const { recipes, error, loading } = useRecipes();
  const [modalOpen, setModalOpen] = useState(false);

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
        <Routes>
          <Route path="/" element={<Home recipes={recipes} />} />
          <Route path="/recipe/:id" element={<RecipeDetail recipes={recipes} />} />
        </Routes>
      </div>
      <ShoppingBar recipes={recipes} onView={() => setModalOpen(true)} />
      {modalOpen && <ShoppingListModal recipes={recipes} onClose={() => setModalOpen(false)} />}
    </ShoppingProvider>
  );
}
