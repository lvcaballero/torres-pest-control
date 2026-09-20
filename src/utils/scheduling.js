// Appointment overlap and status-transition helpers.
//
// The transition rules mirror the appointments_enforce_status_transition trigger
// in supabase/migrations/027-appointment-integrity.sql. The database is the
// authority; these exist so the UI can hide moves the server would reject.

import { APPOINTMENT_STATUS_TRANSITIONS } from "./constants";

export const startOf = (appointment) => new Date(appointment.scheduledAt).getTime();
export const endOf = (appointment) => startOf(appointment) + (appointment.durationMinutes || 60) * 60000;

export function appointmentsOverlap(a, b) {
  return startOf(a) < endOf(b) && endOf(a) > startOf(b);
}

/**
 * Side-by-side placement for one day of the week calendar.
 *
 * Appointments are grouped into clusters — runs that actually overlap each
 * other — and columns are counted per cluster, not per day. That is the whole
 * point: a lone 4 PM visit must stay full width even when 9 AM had four
 * appointments stacked up. Splitting by the day's worst hour was the old bug.
 *
 * A cluster wider than `maxColumns` keeps its first `maxColumns - 1` columns and
 * reports the rest as overflow, so a card is never narrower than 1/maxColumns
 * and stays readable however booked the day is.
 */
export function layoutDayAppointments(dayAppointments, { maxColumns = 3 } = {}) {
  const sorted = [...dayAppointments].sort((a, b) => startOf(a) - startOf(b) || endOf(b) - endOf(a));

  const clusters = [];
  let current = [];
  let clusterEnd = -Infinity;

  sorted.forEach((appointment) => {
    if (current.length && startOf(appointment) >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(appointment);
    clusterEnd = Math.max(clusterEnd, endOf(appointment));
  });
  if (current.length) clusters.push(current);

  const placed = [];
  const overflow = [];

  clusters.forEach((cluster) => {
    // Greedy column packing: reuse the first column whose last occupant ended.
    const columnEnds = [];
    const columnOf = new Map();

    cluster.forEach((appointment) => {
      let column = columnEnds.findIndex((end) => end <= startOf(appointment));
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = endOf(appointment);
      columnOf.set(appointment.id, column);
    });

    const needed = columnEnds.length;
    if (needed <= maxColumns) {
      cluster.forEach((appointment) => {
        placed.push({ appointment, column: columnOf.get(appointment.id), columns: needed });
      });
      return;
    }

    // Too many to show at a readable width: keep the earliest columns and
    // collect everything past them behind a "+N more" tile in the last slot.
    const kept = [];
    const hidden = [];
    cluster.forEach((appointment) => {
      if (columnOf.get(appointment.id) < maxColumns - 1) kept.push(appointment);
      else hidden.push(appointment);
    });

    kept.forEach((appointment) => {
      placed.push({ appointment, column: columnOf.get(appointment.id), columns: maxColumns });
    });

    overflow.push({
      id: `overflow-${hidden[0].id}`,
      column: maxColumns - 1,
      columns: maxColumns,
      start: Math.min(...hidden.map(startOf)),
      end: Math.max(...hidden.map(endOf)),
      items: hidden,
    });
  });

  return { placed, overflow };
}

/**
 * The bookable window of a working day, in local hours. The week grid renders
 * exactly these rows, so a visit outside them is one nobody can see or drag.
 */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 19;
// The calendar shows the boundary row so existing 7 PM appointments remain visible.
// DAY_END_HOUR remains the booking cutoff used by validation.
export const CALENDAR_END_HOUR = DAY_END_HOUR + 1;

const clockLabel = (hour) => `${String(hour % 12 || 12)}:00 ${hour < 12 ? "AM" : "PM"}`;

const minutesLabel = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

/**
 * Why a visit cannot occupy this slot, or null when it can.
 *
 * Two rules, in the order a scheduler would hit them:
 *
 *   1. It has to fit inside the working day. A 90-minute visit starting at
 *      6 PM ends after close, and the week grid has no row to draw it in.
 *   2. Its technician has to be free. Overlap is per-technician on purpose —
 *      two technicians working at once is normal, and an unassigned visit has
 *      nobody to clash with yet.
 *
 * The database enforces both as well. This exists so the form can refuse
 * before a round trip, and say something more useful than the raw error.
 */
export function describeSlotConflict(appointments, candidate) {
  const start = new Date(candidate.scheduledAt);
  if (Number.isNaN(start.getTime())) return "Enter a valid date and time.";

  const duration = Number(candidate.durationMinutes) || 0;
  if (duration <= 0) return "Set how long the visit will take.";

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const openMinutes = DAY_START_HOUR * 60;
  const closeMinutes = DAY_END_HOUR * 60;

  if (startMinutes < openMinutes || startMinutes >= closeMinutes) {
    return `Visits start between ${clockLabel(DAY_START_HOUR)} and ${clockLabel(DAY_END_HOUR)}. Pick a time inside the working day.`;
  }

  const endMinutes = startMinutes + duration;
  if (endMinutes > closeMinutes) {
    const available = closeMinutes - startMinutes;
    return `A ${minutesLabel(duration)} visit starting then runs past ${clockLabel(DAY_END_HOUR)}. Only ${minutesLabel(available)} is left in the day — shorten it or start earlier.`;
  }

  const clashes = findTechnicianConflicts(appointments, candidate);
  if (clashes.length > 0) {
    const when = new Date(clashes[0].scheduledAt)
      .toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `That technician is already booked at ${when}. Choose another technician or a free time.`;
  }

  return null;
}

/** Appointments that would clash with `appointment` for its assigned technician. */
export function findTechnicianConflicts(appointments, appointment) {
  if (!appointment.technicianId) return [];
  return appointments.filter((entry) =>
    entry.id !== appointment.id
    && entry.status !== "Cancelled"
    && entry.technicianId === appointment.technicianId
    && appointmentsOverlap(entry, appointment));
}

/** Technician ids already booked during `appointment`'s time window. */
export function busyTechnicianIds(appointments, appointment) {
  return new Set(appointments
    .filter((entry) =>
      entry.id !== appointment.id
      && entry.technicianId
      && entry.status !== "Cancelled"
      && appointmentsOverlap(entry, appointment))
    .map((entry) => entry.technicianId));
}

export function canTransition(from, to) {
  if (from === to) return true;
  return (APPOINTMENT_STATUS_TRANSITIONS[from] || []).includes(to);
}

/** The statuses a status select should offer, current status included. */
export function allowedNextStatuses(from) {
  return [from, ...(APPOINTMENT_STATUS_TRANSITIONS[from] || [])];
}
