// Stat tile used by all three role dashboards.

import { colors } from "../../styles/theme";

function MetricCard({ title, value, accent, Icon }) {
  return (
    <div
      style={{
        background: "#fcfaf1",
        border: `1px solid ${colors.softLine}`,
        borderRadius: "7.5px",
        padding: "1.25rem",
        boxShadow: "none",
        minHeight: "128px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <span
          style={{
            fontSize: "0.8rem",
            color: colors.muted,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "7.5px",
            display: "grid",
            placeItems: "center",
            background: accent,
            color: "#ffffff",
            boxShadow: "none",
          }}
        >
          {Icon && <Icon size={18} />}
        </div>
      </div>
      <div style={{ fontSize: "2.1rem", fontWeight: 500, color: colors.ink, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

export default MetricCard;
