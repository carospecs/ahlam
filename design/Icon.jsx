// Lucide icon renderer for inline React (UMD lucide on window).
// lucide.icons.Camera === [["path",{d}], ["circle",{cx,cy,r}], ...]
function Icon({ name, size = 20, strokeWidth = 2, className = "", style = {}, color }) {
  const data = (window.lucide && window.lucide.icons && window.lucide.icons[name]) || null;
  if (!data) {
    return React.createElement("svg", {
      width: size, height: size, viewBox: "0 0 24 24", className, style
    });
  }
  const children = data.map(([tag, attrs], i) =>
    React.createElement(tag, { key: i, ...attrs })
  );
  return React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    style,
  }, children);
}

window.Icon = Icon;
