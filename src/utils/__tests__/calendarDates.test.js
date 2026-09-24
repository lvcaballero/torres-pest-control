// These helpers all work in LOCAL time deliberately: a scheduler booking
// "9:00 AM" means 9 AM where they are sitting. Several of the tests below
// exist specifically to stop someone "simplifying" one of them into
// toISOString(), which would shift an evening appointment into the next day's
// column for anyone east of Greenwich.

import {
  addDays,
  defaultAppointmentDateTime,
  formatDuration,
  isSameDay,
  localDateKey,
  minutesOfDay,
  minutesToTimeValue,
  readDuration,
  startOfWeek,
  toDateTimeLocal,
} from "../calendarDates";

describe("localDateKey", () => {
  it("formats a local date with padded parts", () => {
    expect(localDateKey(new Date(2026, 8, 7))).toBe("2026-09-07");
    expect(localDateKey(new Date(2026, 11, 25))).toBe("2026-12-25");
  });

  // The reason this is hand-built rather than sliced off toISOString().
  it("keeps a late-evening time on its own day", () => {
    expect(localDateKey(new Date(2026, 8, 22, 23, 45))).toBe("2026-09-22");
  });

  it("keeps an early-morning time on its own day", () => {
    expect(localDateKey(new Date(2026, 8, 22, 0, 15))).toBe("2026-09-22");
  });
});

describe("startOfWeek", () => {
  // The calendar is Monday-first but getDay() is Sunday-first, so Sunday is
  // the last day of its week rather than the first.
  it("returns the Monday of the week containing the date", () => {
    // 2026-09-22 is a Tuesday.
    expect(localDateKey(startOfWeek(new Date(2026, 8, 22)))).toBe("2026-09-21");
  });

  it("treats Sunday as the end of its week, not the start of the next", () => {
    // 2026-09-27 is a Sunday.
    expect(localDateKey(startOfWeek(new Date(2026, 8, 27)))).toBe("2026-09-21");
  });

  it("leaves a Monday where it is", () => {
    expect(localDateKey(startOfWeek(new Date(2026, 8, 21)))).toBe("2026-09-21");
  });

  it("returns midnight", () => {
    const monday = startOfWeek(new Date(2026, 8, 22, 16, 30));

    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
  });

  it("does not mutate the date it was given", () => {
    const input = new Date(2026, 8, 22);
    startOfWeek(input);

    expect(localDateKey(input)).toBe("2026-09-22");
  });
});

describe("addDays", () => {
  it("shifts forwards and backwards", () => {
    expect(localDateKey(addDays(new Date(2026, 8, 21), 6))).toBe("2026-09-27");
    expect(localDateKey(addDays(new Date(2026, 8, 21), -1))).toBe("2026-09-20");
  });

  it("rolls over a month boundary", () => {
    expect(localDateKey(addDays(new Date(2026, 8, 30), 1))).toBe("2026-10-01");
  });

  it("does not mutate its input", () => {
    const input = new Date(2026, 8, 21);
    addDays(input, 7);

    expect(localDateKey(input)).toBe("2026-09-21");
  });
});

describe("isSameDay", () => {
  it("ignores the time of day", () => {
    expect(isSameDay(new Date(2026, 8, 22, 7, 0), new Date(2026, 8, 22, 19, 0))).toBe(true);
  });

  it("separates adjacent days", () => {
    expect(isSameDay(new Date(2026, 8, 22, 23, 59), new Date(2026, 8, 23, 0, 1))).toBe(false);
  });
});

describe("toDateTimeLocal", () => {
  // A datetime-local input has no timezone of its own, so handing it a raw
  // ISO string would show the wrong clock time to everyone off UTC.
  it("produces the wall-clock time, not the UTC one", () => {
    expect(toDateTimeLocal(new Date(2026, 8, 22, 14, 30))).toBe("2026-09-22T14:30");
  });

  it("emits the exact shape the input expects", () => {
    expect(toDateTimeLocal(new Date(2026, 8, 7, 9, 5))).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("defaultAppointmentDateTime", () => {
  const at = (hours, minutes = 0) => {
    const date = new Date(2026, 8, 24, hours, minutes);
    return date;
  };

  it("opens on today at the start of the working day, before it has begun", () => {
    expect(defaultAppointmentDateTime(7, { now: at(6, 15) })).toBe("2026-09-24T07:00");
  });

  it("follows a different opening hour", () => {
    expect(defaultAppointmentDateTime(9, { now: at(6) })).toMatch(/T09:00$/);
  });

  // It used to open on 7:00 all day long — a past time after 7 am, which the
  // booking rules now refuse.
  it("moves to the next whole hour once the day has started", () => {
    expect(defaultAppointmentDateTime(7, { now: at(10, 20) })).toBe("2026-09-24T11:00");
  });

  it("rolls to tomorrow's opening after the working day ends", () => {
    expect(defaultAppointmentDateTime(7, { now: at(17, 30) })).toBe("2026-09-25T07:00");
    expect(defaultAppointmentDateTime(7, { now: at(23, 10) })).toBe("2026-09-25T07:00");
  });

  it("never returns a time in the past", () => {
    const now = new Date();
    expect(new Date(defaultAppointmentDateTime()).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("readDuration", () => {
  const form = (entries) => new Map(Object.entries(entries));

  it("combines the hours and minutes fields", () => {
    expect(readDuration(form({ durationHours: "1", durationMinutes: "30" }))).toBe(90);
  });

  it("treats blank or missing fields as zero", () => {
    expect(readDuration(form({ durationHours: "2", durationMinutes: "" }))).toBe(120);
    expect(readDuration(form({}))).toBe(0);
  });

  it("ignores a non-numeric value rather than producing NaN", () => {
    expect(readDuration(form({ durationHours: "abc", durationMinutes: "45" }))).toBe(45);
  });
});

describe("formatDuration", () => {
  it.each([
    [60, "1 hour"],
    [120, "2 hours"],
    [90, "1 hour and 30 minutes"],
    [45, "45 minutes"],
  ])("reads %i minutes back as %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("minutesToTimeValue and minutesOfDay", () => {
  it("formats minutes-since-midnight as a padded clock value", () => {
    expect(minutesToTimeValue(540)).toBe("09:00");
    expect(minutesToTimeValue(9 * 60 + 5)).toBe("09:05");
    expect(minutesToTimeValue(0)).toBe("00:00");
  });

  it("round-trips against minutesOfDay", () => {
    const minutes = 14 * 60 + 25;
    const value = minutesToTimeValue(minutes);

    expect(minutesOfDay(`2026-09-22T${value}:00`)).toBe(minutes);
  });
});
