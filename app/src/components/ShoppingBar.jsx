import { useShopping } from "../context/ShoppingContext";

export default function ShoppingBar({ recipes, onView }) {
  const { selected, clear } = useShopping();
  const n = selected.size;
  if (n === 0) return null;

  const fishCount = [...selected].filter((id) => recipes.find((r) => r.id === id)?.fish).length;

  return (
    <div className="shopbar">
      <div className="shopbar-inner">
        <div className="sinfo">
          <span><b>{n}</b> meal{n > 1 ? "s" : ""} selected</span>
          <span className="fishnote">
            {fishCount > 0 ? `${fishCount} fish meal${fishCount > 1 ? "s" : ""} included` : "No fish selected yet — aim for at least one"}
          </span>
        </div>
        <button type="button" className="clearbtn" onClick={clear}>Clear</button>
        <button type="button" className="viewbtn" onClick={onView}>View shopping list</button>
      </div>
    </div>
  );
}
