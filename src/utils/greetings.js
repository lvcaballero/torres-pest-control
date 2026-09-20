// Rotating copy for the sign-in hero and the dashboard greeting.
//
// Kept out of the components because the sign-in hero is rendered twice — once
// on the red panel and once in cream, revealed through the curved edge — and the
// two must always read the same. One call, two renders.
//
// Lines are short on purpose: the hero is set at a display size and wraps to two
// lines at most widths. Anything longer than about five words starts to crowd
// the curve.

const HERO_LINES = {
  morning: [
    "Good morning",
    "First route of the day",
    "Let's make a start",
    "Early one today",
  ],
  afternoon: [
    "Good to see you again",
    "Back at it",
    "Good afternoon",
    "Let's keep it moving",
  ],
  evening: [
    "Good evening",
    "Wrapping up the day",
    "Last of the rounds",
    "Still going",
  ],
};

// Reset is its own pool, not a reworded greeting: whoever reaches that page is
// locked out, so the line reassures rather than welcomes.
const RESET_LINES = {
  morning: [
    "Let's get you back in",
    "Happens to everyone",
    "We'll sort this out",
    "Back in a moment",
  ],
  afternoon: [
    "Happens to everyone",
    "Let's get you back in",
    "No trouble at all",
    "We'll sort this out",
  ],
  evening: [
    "We'll sort this out",
    "Happens to everyone",
    "Let's get you back in",
    "Nearly there",
  ],
};

const DASHBOARD_NOTES = {
  morning: [
    "Here's how today is shaping up.",
    "Everything on the books for today.",
    "A fresh day on the schedule.",
  ],
  afternoon: [
    "Here's where things stand.",
    "The afternoon's work at a glance.",
    "Halfway through the day.",
  ],
  evening: [
    "Here's how the day finished up.",
    "Closing out the day.",
    "The day's work, wrapped.",
  ],
};

/** Morning until noon, afternoon until 5pm, evening after. */
export function timeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

const pick = (options) => options[Math.floor(Math.random() * options.length)];

/** A short line for the sign-in hero. Call once per mount and reuse the result. */
export function heroLine(date = new Date()) {
  return pick(HERO_LINES[timeOfDay(date)]);
}

/** A short line for the reset hero. Call once per mount and reuse the result. */
export function resetLine(date = new Date()) {
  return pick(RESET_LINES[timeOfDay(date)]);
}

/** "Good morning, Aileen" — falls back gracefully when no name is loaded yet. */
export function greetingFor(name, date = new Date()) {
  const part = timeOfDay(date);
  const salutation = part === "morning" ? "Good morning"
    : part === "afternoon" ? "Good afternoon"
      : "Good evening";
  return name ? `${salutation}, ${name}` : salutation;
}

/** A supporting line under the dashboard greeting. */
export function dashboardNote(date = new Date()) {
  return pick(DASHBOARD_NOTES[timeOfDay(date)]);
}
