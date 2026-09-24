// The key to the calendar's status edges, always on screen under the grid.
// A swatch per status drawn exactly as a card draws it, plus the word.

import { neutral, radius } from "../../styles/tokens";
import { LEGEND_STATUSES, statusVisual } from "./appointmentTheme";

export function LegendSwatch({ status }) {
  const visual = statusVisual(status);
  return (
    <span
      aria-hidden="true"
      style={{
        width: "14px",
        height: "12px",
        flex: "none",
        borderRadius: "2px",
        borderWidth: "1px",
        borderStyle: visual.borderStyle,
        borderColor: neutral.loam,
        borderLeftWidth: "3px",
        borderLeftStyle: "solid",
        borderLeftColor: visual.edge,
        background: visual.fill,
      }}
    />
  );
}

function CalendarLegend({ note = null }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 18px",
        fontSize: "12.5px",
        color: neutral.saddle,
      }}
    >
      <ul
        aria-label="Legend"
        style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", margin: 0, padding: 0, listStyle: "none" }}
      >
        {LEGEND_STATUSES.map((status) => {
          const visual = statusVisual(status);
          return (
            <li key={status} style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: radius.control }}>
              <LegendSwatch status={status} />
              <span style={{ textDecoration: visual.strike ? "line-through" : "none" }}>{visual.label}</span>
            </li>
          );
        })}
      </ul>
      {note && <span style={{ marginLeft: "auto", color: neutral.bark }}>{note}</span>}
    </div>
  );
}

export default CalendarLegend;
