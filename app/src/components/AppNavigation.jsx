import { NavLink } from "react-router-dom";
import { useShopping } from "../context/ShoppingContext";

export default function AppNavigation() {
  const { selected } = useShopping();
  return <nav className="app-navigation" aria-label="Main navigation">
    <NavLink to="/week">Weekly menu <span>{selected.size}</span></NavLink>
    <NavLink to="/recipes">Recipe bank</NavLink>
    {import.meta.env.PROD && <form action="/auth/logout" method="post" className="logout-form"><button type="submit">Sign out</button></form>}
  </nav>;
}
