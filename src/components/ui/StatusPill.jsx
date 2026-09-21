// A small stamp for a status or a role.
//
// Replaces four parallel implementations: badgeStyle() in SchedulingPage,
// `badge` in theme.js, Chip in DashboardParts, and roleBadgeColors in Navbar.
// The pill radius is deliberate and the one place it is allowed — a stamp is
// not a button, and the design language reserves 3.75px for controls.

import { neutral, radius, status as semantic, surface, text, weight } from "../../styles/tokens";

/**
 * Appointment statuses, plus the roles Navbar stamps. Kept desaturated so the
 * pills sit inside the warm palette rather than shouting over it.
 */
export const TONES = {
  neutral: { background: surface.sunken, color: neutral.saddle },
  success: { background: semantic.successSurface, color: semantic.success },
  warning: { background: semantic.warningSurface, color: semantic.warning },
  danger: { background: semantic.dangerSurface, color: semantic.danger },
  brand: { background: "rgba(127, 17, 17, 0.08)", color: "#8b1e1e" },
};

const STATUS_TONES = {
  Pending: "warning",
  Confirmed: "brand",
  Reschedule: "warning",
  Completed: "success",
  Cancelled: "danger",
  Scheduled: "neutral",
  ACTIVE: "success",
  INACTIVE: "neutral",
  ADMIN: "brand",
  STAFF: "neutral",
  TECHNICIAN: "success",
};

/** The tone for a status or role string, falling back to neutral. */
export function toneFor(value) {
  return STATUS_TONES[value] || "neutral";
}

function StatusPill({ children, tone, status, icon = null, style, ...rest }) {
  const palette = TONES[tone || toneFor(status || children)] || TONES.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        borderRadius: radius.pill,
        padding: "2px 10px",
        fontSize: text.caption.fontSize,
        fontWeight: weight.medium,
        letterSpacing: text.caption.letterSpacing,
        whiteSpace: "nowrap",
        ...palette,
        ...style,
      }}
      {...rest}
    >
      {icon}
      {status || children}
    </span>
  );
}

export default StatusPill;
