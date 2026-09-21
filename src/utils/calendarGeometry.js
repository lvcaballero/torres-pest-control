// Minutes <-> pixels for the week grid.
//
// The grid draws one uniform row per visible hour, so the mapping between a
// clock time and a vertical offset is linear: it needs only an origin
// (`gridStartHour`) and a scale (`rowHeight`). Every position in the calendar
// derives from these two functions — card tops, card heights, the time you
// get when you click an empty slot, and the time an appointment lands on when
// you drop it.
//
// That last pair is why this lives in its own module rather than inside the
// component. `pixelToMinutes` is the inverse of `minutesToPixel`, and if the
// two ever disagree, a dragged appointment silently saves to a different time
// than the one the user dropped it on. A round-trip test covers exactly that.
//
// These used to hard-code DAY_START_HOUR and a module-constant ROW_HEIGHT,
// which is why the grid could only ever render the full 7 AM - 8 PM day.

import { minutesOfDay } from "./calendarDates";
import { endOf, startOf } from "./scheduling";

/** The pixel height of one hour row, given how many hours are on screen. */
export function rowHeightForWindow(hourCount) {
  // Fewer hours visible means each one can afford more height, which is what
  // makes a readable card possible: a one-hour visit in a six-hour window is
  // an 88px block instead of a 56px one.
  if (hourCount <= 6) return 88;
  if (hourCount <= 9) return 72;
  if (hourCount <= 11) return 64;
  return 56;
}

/**
 * The hours the grid should render.
 *
 * A week with four appointments used to draw all thirteen business hours, so
 * the page was mostly empty ruled paper. This narrows to the hours the week
 * actually uses, padded by an hour either side for drop room.
 *
 * Two guarantees the callers depend on:
 *
 *   1. It never hides an appointment. If a legacy 6:30 AM visit exists the
 *      window widens BELOW the business day to include it — otherwise that
 *      visit would be invisible, undraggable, and effectively lost. This is
 *      why the start is not clamped to `businessStart`.
 *   2. It never returns fewer than `minHours` rows, so one appointment cannot
 *      produce a two-row grid with nowhere to drop anything else.
 *
 * Growth to `minHours` goes downwards first, so the earliest appointment
 * stays near the top of the grid where a scheduler expects to find it.
 */
export function visibleHourWindow(
  appointments,
  { businessStart = 7, businessEnd = 20, minHours = 6, pad = 1 } = {}
) {
  const withMinimumSpan = (startHour, endHour) => {
    let start = startHour;
    let end = endHour;

    if (end - start < minHours) end = Math.min(Math.max(businessEnd, end), start + minHours);
    if (end - start < minHours) end = Math.min(24, start + minHours);
    if (end - start < minHours) start = Math.max(0, end - minHours);

    return { startHour: start, endHour: end };
  };

  if (!appointments || appointments.length === 0) {
    // An empty week opens on the core of the working day, not all of it.
    const start = Math.max(businessStart, 9);
    return withMinimumSpan(start, Math.min(businessEnd, start + minHours));
  }

  let earliest = Infinity;
  let latest = -Infinity;

  appointments.forEach((appointment) => {
    const startMinutes = minutesOfDay(startOf(appointment));
    const endMinutes = startMinutes + (endOf(appointment) - startOf(appointment)) / 60000;

    earliest = Math.min(earliest, Math.floor(startMinutes / 60));
    // Rounding up means a visit ending at 10:30 keeps the 10 AM row; one
    // ending exactly at 10:00 does not claim a row it does not occupy.
    latest = Math.max(latest, Math.ceil(endMinutes / 60));
  });

  return withMinimumSpan(Math.max(0, earliest - pad), Math.min(24, latest + pad));
}

/** The full bookable day, for the "show all hours" override. */
export function fullDayWindow(businessStart = 7, businessEnd = 20) {
  return { startHour: businessStart, endHour: businessEnd };
}

/** Every hour the window covers, as a list of hour numbers. */
export function hoursIn({ startHour, endHour }) {
  return Array.from({ length: Math.max(0, endHour - startHour) }, (_, index) => startHour + index);
}

/** Minutes from the top of the rendered grid. Negative means above it. */
export function minutesFromGridStart(value, gridStartHour) {
  return minutesOfDay(value) - gridStartHour * 60;
}

/** A clock time -> its vertical offset in pixels. */
export function minutesToPixel(minutesFromStart, rowHeight) {
  return (minutesFromStart / 60) * rowHeight;
}

/**
 * A vertical offset -> the clock time it represents, snapped to `snapTo`.
 *
 * The exact inverse of minutesToPixel before snapping. Used by both the
 * click-to-create handler and the drop handler, which is why it is one
 * function rather than the same three lines written twice.
 */
export function pixelToMinutes(offsetPixels, { gridStartHour, rowHeight, snapTo = 0 }) {
  const raw = (offsetPixels / rowHeight) * 60 + gridStartHour * 60;
  return snapTo > 0 ? Math.round(raw / snapTo) * snapTo : raw;
}

/**
 * Clamp a proposed start time to the hours a visit may actually be BOOKED in.
 *
 * Deliberately separate from the display window. The grid may show 6 AM so a
 * legacy appointment is visible, but creating one there must still be
 * refused — the booking bound is enforced by describeSlotConflict and by the
 * database trigger in migration 027, and letting the two drift would produce
 * a UI that offers times the server rejects.
 */
export function clampToBookableDay(minutes, { dayStartHour, dayEndHour, minDuration = 10 }) {
  return Math.min(dayEndHour * 60 - minDuration, Math.max(dayStartHour * 60, minutes));
}

/** Left/width for one card in a cluster of `columns` side-by-side cards. */
export function columnPlacement(column, columns) {
  return {
    left: `calc(${(column / columns) * 100}% + 3px)`,
    width: `calc(${100 / columns}% - 6px)`,
  };
}

/**
 * Top and height in pixels for an appointment spanning `startValue`..`endValue`.
 *
 * `minHeight` keeps a very short visit legible rather than letting it render
 * as an unreadable sliver — a 15-minute visit overlapping the next slot by a
 * few pixels is strictly better than one nobody can read.
 */
export function spanGeometry(
  startValue,
  endValue,
  { gridStartHour, rowHeight, minHeight = 30, gap = 2 }
) {
  const top = minutesToPixel(minutesFromGridStart(startValue, gridStartHour), rowHeight);
  const rawHeight = ((endValue - startValue) / 60000 / 60) * rowHeight;
  return { top, height: Math.max(minHeight, rawHeight - gap) };
}
