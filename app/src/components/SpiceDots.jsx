export default function SpiceDots({ level }) {
  return (
    <span className="spice-dots" title="Spice level">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < level ? "on" : ""} />
      ))}
    </span>
  );
}
