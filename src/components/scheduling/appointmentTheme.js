// How an appointment block is coloured and what its status looks like.
//
// COLOUR SAYS WHO, THE RAIL AND GLYPH SAY WHAT STATE.
//
// Technician colour stays the card fill: overlapping cards are always
// different technicians, since the database forbids double-booking one, so
// fill is what tells them apart at a glance and an overloaded technician
// shows up across the whole week without reading a word.
//
// Status used to be encoded as dashed vs dotted vs solid 1px borders plus two
// opacity values. At a 90px-wide, 22px-tall card that is invisible, which is
// exactly why the page had to carry a sentence explaining it in prose. A
// legend that explains your encoding is a sign the encoding failed.
//
// Each status now carries THREE cues — a fill treatment, a glyph, and a text
// treatment — so it survives being read at a glance, at a small size, and by
// someone who cannot distinguish the hues.

import { neutral, status as semantic } from "../../styles/tokens";

/** Fill / text / rail for each technician, assigned by list order. */
export const TECHNICIAN_PALETTE = [
  { fill: "#d9f0ef", ink: "#0a6b6d", bar: "#0e8f92" },
  { fill: "#e2e3fb", ink: "#3a44b8", bar: "#4f5bd5" },
  { fill: "#fbe8d4", ink: "#94540a", bar: "#c07a10" },
  { fill: "#dcefdc", ink: "#2c6b33", bar: "#3f8b47" },
  { fill: "#f6e0f4", ink: "#8a2f83", bar: "#a9459f" },
  { fill: "#dfeaf9", ink: "#1f5c9c", bar: "#2f7cc4" },
];

// Unassigned is deliberately the odd one out: those appointments skip the
// double-booking check entirely, so the dispatch backlog should be obvious.
export const UNASSIGNED_COLOR = { fill: "#fadfe5", ink: "#97324a", bar: "#bf4460" };

/** The palette entry for a technician id, by their position in the list. */
export function technicianColorMap(technicians) {
  const map = new Map();
  technicians.forEach((account, index) => {
    map.set(account.id, TECHNICIAN_PALETTE[index % TECHNICIAN_PALETTE.length]);
  });
  return map;
}

/** Background and text for a status pill, in the warm palette. */
export const STATUS_COLORS = {
  Pending: [semantic.warningSurface, semantic.warning],
  Scheduled: [semantic.infoSurface, semantic.info],
  Confirmed: ["rgba(127, 17, 17, 0.08)", "#8b1e1e"],
  Reschedule: [semantic.warningSurface, semantic.warning],
  Completed: [semantic.successSurface, semantic.success],
  Cancelled: [semantic.dangerSurface, semantic.danger],
};

export function badgeStyle(status) {
  const [background, color] = STATUS_COLORS[status] || STATUS_COLORS.Pending;
  return {
    background,
    color,
    borderRadius: 999,
    padding: "2px 9px",
    fontSize: "11px",
    fontWeight: 500,
    whiteSpace: "nowrap",
  };
}

/** Status has to survive a card too small for its pill, so it also colors the edge. */
export function statusAccent(status) {
  return (STATUS_COLORS[status] || STATUS_COLORS.Pending)[1];
}

/**
 * The OLD status encoding, still read by the card until it is rewritten.
 *
 * @deprecated Use statusVisual. A 1px dashed-vs-dotted border and two opacity
 * values are indistinguishable on a 90px-wide card, which is why the page had
 * to carry a prose legend explaining them.
 */
export function statusShape(status) {
  if (status === "Cancelled") return { borderStyle: "solid", opacity: 0.5, strike: true, dim: true };
  if (status === "Completed") return { borderStyle: "solid", opacity: 0.78, strike: false, dim: true };
  if (status === "Pending") return { borderStyle: "dashed", opacity: 1, strike: false, dim: false };
  if (status === "Reschedule") return { borderStyle: "dotted", opacity: 1, strike: false, dim: false };
  return { borderStyle: "solid", opacity: 1, strike: false, dim: false };
}

/**
 * The visual treatment for one status.
 *
 * `glyph` is a short label name resolved to a lucide icon by the card, kept
 * as a string so this module stays free of JSX and is testable as data.
 *
 * `railColor` overrides the technician's rail, which is what makes status the
 * high-contrast cue and technician the ambient one.
 */
export function statusVisual(status) {
  switch (status) {
    case "Cancelled":
      return {
        glyph: "cancelled",
        opacity: 0.55,
        strike: true,
        mutedText: true,
        railColor: neutral.loam,
        hatch: false,
        borderWidth: 1,
      };
    case "Completed":
      return {
        glyph: "completed",
        opacity: 1,
        strike: false,
        mutedText: true,
        railColor: semantic.success,
        hatch: false,
        borderWidth: 1,
        // A real surface colour rather than a CSS filter: `saturate(0.55)`
        // made a finished visit look like a rendering fault.
        tint: "rgba(33, 27, 21, 0.06)",
      };
    case "Pending":
      return {
        glyph: "pending",
        opacity: 1,
        strike: false,
        mutedText: false,
        railColor: semantic.warning,
        // A hatch reads at any size, unlike a 1px dashed border.
        hatch: true,
        borderWidth: 1,
      };
    case "Reschedule":
      return {
        glyph: "reschedule",
        opacity: 1,
        strike: false,
        mutedText: false,
        railColor: semantic.warning,
        hatch: false,
        borderWidth: 2,
      };
    default:
      return {
        glyph: null,
        opacity: 1,
        strike: false,
        mutedText: false,
        railColor: null, // keep the technician's own rail
        hatch: false,
        borderWidth: 1,
      };
  }
}

/** The diagonal hatch overlay a Pending card carries. */
export const HATCH_IMAGE =
  "repeating-linear-gradient(45deg, rgba(33, 27, 21, 0.06) 0 6px, transparent 6px 12px)";

/**
 * How much of an appointment a card of this pixel height can show.
 *
 * The old flags (`roomy`, `tight`, `compact`) were read directly in the
 * render and each tier redefined its own font sizes inline. Naming the tiers
 * means the card has one switch instead of four conditionals.
 */
export function contentTier(height) {
  if (height >= 76) return "full"; // time + glyph, name over two lines, technician + concern
  if (height >= 48) return "medium"; // name on one line, time range, glyph
  return "compact"; // name and start time, one line
}
