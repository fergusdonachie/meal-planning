import { NavLink } from "react-router-dom";
import { useShopping } from "../context/ShoppingContext";

export default function AppNavigation() {
  const { selected } = useShopping();
  return <nav className="app-navigation" aria-label="Main navigation">
    <NavLink to="/" end>Recipe bank</NavLink>
    <NavLink to="/week">This week's recipes <span>{selected.size}</span></NavLink>
    {import.meta.env.PROD && <form action="/auth/logout" method="post" className="logout-form"><button type="submit">Sign out</button></form>}
  </nav>;
}
