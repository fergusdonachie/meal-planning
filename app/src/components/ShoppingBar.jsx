import { useShopping } from "../context/ShoppingContext";
import { Link, useLocation } from "react-router-dom";
import { weekLabel } from "../lib/weeklyMenu";

export default function ShoppingBar({ onView }) {
  const { selected, week } = useShopping();
  const location = useLocation();
  if (!selected.size) return null;
  const onMenu = location.pathname === "/week" && new URLSearchParams(location.search).get("view") !== "ideas";
  return <div className="shopbar"><div className="shopbar-inner">
    <div className="sinfo"><span><b>{selected.size}</b> meal{selected.size === 1 ? "" : "s"} in your menu</span><span className="fishnote">{weekLabel(week)}</span></div>
    {!onMenu && <Link className="week-bar-link" to="/week?view=menu">View menu →</Link>}
    <button type="button" className="viewbtn" onClick={onView}>Shopping list</button>
  </div></div>;
}
