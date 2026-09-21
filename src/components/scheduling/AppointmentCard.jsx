// One appointment, as drawn in the week grid, the month grid, or the
// overflow dialog.
//
// The card adapts to its own pixel height. A 15-minute visit and a
// three-hour visit are the same component but cannot show the same things,
// and the previous version handled that with three booleans read inline,
// each tier redefining its own font sizes. contentTier names the three
// cases so this has one switch instead of four conditionals.
//
// Truncation was the loudest complaint about the old grid — client names
// rendered as "Clizfel Tes...". Two things fix it: the window narrowing in
// calendarGeometry makes a one-hour visit 88px tall instead of 56px, and at
// that height the name gets two clamped lines instead of one ellipsised one.
// A 95px-wide column will never fit every name, so the native title
// attribute still carries the full detail on hover.
//
// `columns` matters as much as height. A card sharing its slot with two
// others is a third of a column wide, and a wrapped name there overflows the
// box no matter how tall it is — so the tier is capped by width too.

import { Check, RotateCcw, X } from "lucide-react";
import { neutral, radius, text, weight } from "../../styles/tokens";
import { formatDuration } from "../../utils/calendarDates";
import { endOf } from "../../utils/scheduling";
import { HATCH_IMAGE, contentTier, statusVisual } from "./appointmentTheme";
import { useCalendar } from "./CalendarContext";

const GLYPHS = {
  completed: Check,
  reschedule: RotateCcw,
  cancelled: X,
  pending: null, // a dot, drawn inline — an icon at this size reads as noise
};

const clockLabel = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** The two-line clamp that stops a long client name being ellipsised away. */
const clampLines = (lines) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  wordBreak: "break-word",
});

function StatusGlyph({ visual, color }) {
  if (visual.glyph === "pending") {
    return (
      <span
        aria-hidden="true"
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          flex: "none",
        }}
      />
    );
  }

  const Icon = GLYPHS[visual.glyph];
  if (!Icon) return null;
  return <Icon size={11} strokeWidth={2.5} color={color} aria-hidden="true" style={{ flex: "none" }} />;
}

function AppointmentCard({ appointment, height = null, columns = 1, placement = null, dense = false }) {
  const {
    clients,
    accounts,
    colorFor,
    selectedId,
    draggedId,
    canReschedule,
    onSelect,
    onDragStart,
    onDragEnd,
  } = useCalendar();

  const client = clients.find((entry) => entry.id === appointment.clientId);
  if (!client) return null;

  const isSelected = appointment.id === selectedId;
  const tone = colorFor(appointment);
  const visual = statusVisual(appointment.status);
  const technician = accounts.find((account) => account.id === appointment.technicianId);
  const technicianName = technician?.name || technician?.username || "Unassigned";

  // A month cell or a dialog row has no measured height; treat it as the
  // middle tier, which is what those layouts have room for.
  const tier = height === null ? (dense ? "compact" : "medium") : contentTier(height, columns);
  const startLabel = clockLabel(appointment.scheduledAt);
  const endLabel = clockLabel(endOf(appointment));
  const railColor = visual.railColor || tone.bar;
  const bodyColor = visual.mutedText ? neutral.saddle : tone.ink;

  const nameStyle = {
    fontWeight: weight.medium,
    fontSize: tier === "compact" ? "11px" : "12px",
    lineHeight: 1.25,
    textDecoration: visual.strike ? "line-through" : "none",
  };

  return (
    <button
      type="button"
      draggable={canReschedule}
      onDragStart={() => canReschedule && onDragStart(appointment)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(appointment)}
      aria-current={isSelected ? "true" : undefined}
      title={`${client.name}
${startLabel} – ${endLabel} · ${formatDuration(appointment.durationMinutes || 60)}
${technicianName} · ${appointment.status}${appointment.pestConcern ? ` · ${appointment.pestConcern}` : ""}`}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: canReschedule ? "grab" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "1px",
        border: `${visual.borderWidth}px solid ${isSelected ? "#7f1111" : railColor}`,
        borderLeft: `3px solid ${railColor}`,
        borderRadius: radius.control,
        padding: tier === "compact" ? "2px 5px" : "4px 6px",
        background: tone.fill,
        // A real surface tint rather than a CSS filter, so a finished visit
        // reads as done rather than as a rendering fault.
        backgroundImage: [visual.hatch ? HATCH_IMAGE : null, visual.tint ? `linear-gradient(${visual.tint}, ${visual.tint})` : null]
          .filter(Boolean)
          .join(", "),
        outline: isSelected ? "2px solid #7f1111" : "none",
        outlineOffset: "1px",
        position: "relative",
        zIndex: isSelected ? 3 : 1,
        opacity: draggedId === appointment.id ? 0.45 : visual.opacity,
        overflow: "hidden",
        color: bodyColor,
        ...placement,
      }}
    >
      {tier === "compact" && (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap", overflow: "hidden" }}>
          <StatusGlyph visual={visual} color={railColor} />
          <span style={{ ...nameStyle, overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</span>
          <span style={{ fontSize: "10px", opacity: 0.8, flex: "none", marginLeft: "auto" }}>{startLabel}</span>
        </span>
      )}

      {tier === "medium" && (
        <>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
            <StatusGlyph visual={visual} color={railColor} />
            <span style={{ ...nameStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {client.name}
            </span>
          </span>
          <span
            style={{
              fontSize: "10px",
              opacity: 0.85,
              whiteSpace: "nowrap",
              // A half-width card cannot fit a full range; ellipsise rather
              // than clip a digit in half.
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {startLabel} – {endLabel}
          </span>
        </>
      )}

      {tier === "full" && (
        <>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", opacity: 0.85 }}>
            <StatusGlyph visual={visual} color={railColor} />
            {startLabel} – {endLabel}
          </span>
          <span style={{ ...nameStyle, ...clampLines(2) }}>{client.name}</span>
          <span style={{ ...text.caption, fontSize: "10px", opacity: 0.72, ...clampLines(1) }}>
            {technicianName}
            {appointment.pestConcern ? ` · ${appointment.pestConcern}` : ""}
          </span>
        </>
      )}
    </button>
  );
}

export default AppointmentCard;
