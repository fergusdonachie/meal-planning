import { NavLink } from "react-router-dom";
import { useShopping } from "../context/ShoppingContext";

export default function AppNavigation({ onShopping }) {
  const { selected } = useShopping();
  return <nav className="app-navigation" aria-label="Main navigation">
    <NavLink to="/week">Your week <span>{selected.size}</span></NavLink>
    <NavLink to="/recipes">Recipe bank</NavLink>
    <button type="button" className="nav-shopping" onClick={onShopping}>Shopping list</button>
  </nav>;
}
