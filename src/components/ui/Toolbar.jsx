// A single-row control bar: view switcher on the left, context in the middle,
// filters and the page action on the right.
//
// Scheduling previously spread these across two stacked rows with the date
// navigation on a third, which is a large part of why that page felt
// unfinished. Wrapping is per-group so a narrow window folds the right-hand
// group under the left rather than breaking a control in half.

import { surface } from "../../styles/tokens";

const groupStyle = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };

function Toolbar({ start = null, center = null, end = null, bordered = true, style, ...rest }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "15px",
        flexWrap: "wrap",
        padding: bordered ? "12px 15px" : 0,
        border: bordered ? `1px solid ${surface.sunken}` : undefined,
        borderRadius: bordered ? "7.5px" : undefined,
        background: bordered ? surface.panel : undefined,
        ...style,
      }}
      {...rest}
    >
      {start && <div style={groupStyle}>{start}</div>}
      {center && <div style={{ ...groupStyle, flex: "1 1 auto", justifyContent: "center" }}>{center}</div>}
      {end && <div style={{ ...groupStyle, marginLeft: "auto" }}>{end}</div>}
    </div>
  );
}

export default Toolbar;
