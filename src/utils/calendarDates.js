// Local-date helpers for the scheduling calendar.
//
// Everything here works in LOCAL time on purpose. Appointments are booked
// against a working day that a human experiences in their own timezone, and
// the grid draws rows for those local hours — so `9:00 AM` must mean 9 AM
// where the scheduler is sitting, not 9 AM UTC.
//
// That is why localDateKey builds its string by hand instead of reaching for
// toISOString(): the latter converts to UTC first, so an evening appointment
// would land on the following day's column for anyone east of Greenwich.

/** `YYYY-MM-DD` for a date, in local time. The key the week grid buckets by. */
export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Midnight on the Monday of the week containing `date`. */
export function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  // getDay() is Sunday-first; the calendar is Monday-first, so Sunday counts
  // as the last day of the previous week rather than the first of this one.
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

/** `date` shifted by whole days, without mutating it. */
export function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

/** Whether two dates fall on the same local day. */
export function isSameDay(a, b) {
  return localDateKey(a) === localDateKey(b);
}

/** `"09:30"` -> `"9:30 AM"`. The arbitrary date only carries the clock. */
export function formatTime(value) {
  if (!value) return "";
  return new Date(`2000-01-01T${value}`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** An hour number -> its clock label, e.g. 13 -> `"1:00 PM"`. */
export function formatHour(hour) {
  return formatTime(`${String(hour).padStart(2, "0")}:00`);
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A value an `<input type="datetime-local">` will accept.
 *
 * The offset subtraction is the point: toISOString() shifts to UTC, and the
 * input has no timezone of its own, so feeding it the raw ISO string would
 * silently show the wrong clock time to everyone not on UTC.
 */
export function toDateTimeLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * The value the create form opens on: the start of the working day, or — once
 * that has passed — the next whole hour, rolling to tomorrow's opening after
 * `endHour`. It used to be today at 7:00 unconditionally, which after 7 am is
 * a time in the past that the booking rules (migration 047) refuse.
 */
export function defaultAppointmentDateTime(startHour = 7, { now = new Date(), endHour = 18 } = {}) {
  const date = new Date(now);
  date.setHours(startHour, 0, 0, 0);
  if (date > now) return toDateTimeLocal(date);

  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  if (nextHour.getHours() >= startHour && nextHour.getHours() < endHour && isSameDay(nextHour, now)) {
    return toDateTimeLocal(nextHour);
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(startHour, 0, 0, 0);
  return toDateTimeLocal(tomorrow);
}

/** `"1 hour and 30 minutes"`, for reading back a duration in prose. */
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours ? `${hours} hour${hours === 1 ? "" : "s"}` : ""}${
    hours && remainingMinutes ? " and " : ""
  }${remainingMinutes ? `${remainingMinutes} minutes` : ""}`;
}

/** Total minutes from a form's separate hours and minutes fields. */
export function readDuration(values) {
  const hours = Number(values.get("durationHours")) || 0;
  const minutes = Number(values.get("durationMinutes")) || 0;
  return hours * 60 + minutes;
}

/** `540` -> `"09:00"`, the shape scheduledAt strings are built from. */
export function minutesToTimeValue(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** The local clock time of a date, as minutes since midnight. */
export function minutesOfDay(value) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}
