// The week grid's minutes <-> pixels core.
//
// The round-trip suite at the bottom is the important one: pixelToMinutes is
// the inverse of minutesToPixel, and if the two ever disagree a dragged
// appointment saves to a different time than the one the user dropped it on —
// silently, with no error anywhere.

import {
  clampToBookableDay,
  columnPlacement,
  fullDayWindow,
  hoursIn,
  minutesFromGridStart,
  minutesToPixel,
  pixelToMinutes,
  rowHeightForWindow,
  spanGeometry,
  visibleHourWindow,
} from "../calendarGeometry";

const DAY = "2026-09-22";
const at = (time, durationMinutes = 60) => ({
  id: time,
  scheduledAt: `${DAY}T${time}:00`,
  durationMinutes,
});

describe("visibleHourWindow", () => {
  it("opens an empty week on the core of the working day, not all of it", () => {
    const { startHour, endHour } = visibleHourWindow([]);

    expect(startHour).toBe(9);
    expect(endHour - startHour).toBeGreaterThanOrEqual(6);
    // The whole point: not the full 7-20 the grid used to always render.
    expect(endHour - startHour).toBeLessThan(13);
  });

  it("treats a missing list the same as an empty one", () => {
    expect(visibleHourWindow(undefined)).toEqual(visibleHourWindow([]));
  });

  it("brackets the week's appointments with an hour of drop room", () => {
    const { startHour, endHour } = visibleHourWindow([at("09:00"), at("14:00")]);

    expect(startHour).toBeLessThanOrEqual(8);
    expect(endHour).toBeGreaterThanOrEqual(16);
  });

  // A visit outside the business day must still be reachable: if the window
  // clamped to businessStart it would be invisible and undraggable.
  it("widens below the business day rather than hiding an early visit", () => {
    const { startHour } = visibleHourWindow([at("06:30"), at("09:00")], { businessStart: 7 });

    expect(startHour).toBeLessThanOrEqual(6);
  });

  it("widens past the business day rather than hiding a late visit", () => {
    const { endHour } = visibleHourWindow([at("20:00")], { businessEnd: 20 });

    expect(endHour).toBeGreaterThanOrEqual(21);
  });

  it("never returns fewer than the minimum number of rows", () => {
    const { startHour, endHour } = visibleHourWindow([at("10:00", 30)], { minHours: 6 });

    expect(endHour - startHour).toBeGreaterThanOrEqual(6);
  });

  it("honours a custom minimum span", () => {
    const { startHour, endHour } = visibleHourWindow([at("10:00", 30)], { minHours: 9 });

    expect(endHour - startHour).toBeGreaterThanOrEqual(9);
  });

  it("never hides any appointment in the week", () => {
    const appointments = [at("07:15", 45), at("12:00", 120), at("18:30", 90)];
    const { startHour, endHour } = visibleHourWindow(appointments);

    expect(startHour).toBeLessThanOrEqual(7);
    // 18:30 + 90 min ends at 20:00, so the last row must cover the 19th hour.
    expect(endHour).toBeGreaterThanOrEqual(20);
  });

  it("stays inside a real day", () => {
    const { startHour, endHour } = visibleHourWindow([at("23:30", 30)]);

    expect(startHour).toBeGreaterThanOrEqual(0);
    expect(endHour).toBeLessThanOrEqual(24);
  });

  it("does not claim an extra row for a visit ending exactly on the hour", () => {
    const onTheHour = visibleHourWindow([at("09:00", 60)], { pad: 0, minHours: 1 });

    expect(onTheHour.endHour).toBe(10);
  });
});

describe("fullDayWindow and hoursIn", () => {
  it("returns the whole bookable day for the show-all override", () => {
    expect(fullDayWindow(7, 20)).toEqual({ startHour: 7, endHour: 20 });
  });

  it("lists one entry per hour in the window", () => {
    expect(hoursIn({ startHour: 9, endHour: 13 })).toEqual([9, 10, 11, 12]);
  });

  it("returns nothing for an empty or inverted window", () => {
    expect(hoursIn({ startHour: 9, endHour: 9 })).toEqual([]);
    expect(hoursIn({ startHour: 13, endHour: 9 })).toEqual([]);
  });
});

describe("rowHeightForWindow", () => {
  it("gives a short window taller rows, which is what makes a card readable", () => {
    expect(rowHeightForWindow(6)).toBeGreaterThan(rowHeightForWindow(13));
  });

  it("never grows a row as the window widens", () => {
    const heights = [4, 6, 8, 9, 10, 11, 12, 13, 24].map(rowHeightForWindow);

    heights.forEach((height, index) => {
      if (index > 0) expect(height).toBeLessThanOrEqual(heights[index - 1]);
    });
  });

  it("keeps the full-day row height the grid has always used", () => {
    expect(rowHeightForWindow(13)).toBe(56);
  });
});

describe("minutesFromGridStart", () => {
  it("measures from the window's origin, not from midnight", () => {
    expect(minutesFromGridStart(`${DAY}T09:30:00`, 9)).toBe(30);
    expect(minutesFromGridStart(`${DAY}T09:30:00`, 7)).toBe(150);
  });

  it("goes negative above the window, so a hidden card is not drawn at the top", () => {
    expect(minutesFromGridStart(`${DAY}T06:00:00`, 7)).toBe(-60);
  });
});

describe("spanGeometry", () => {
  const options = { gridStartHour: 9, rowHeight: 60, minHeight: 30, gap: 2 };
  const ms = (time) => new Date(`${DAY}T${time}:00`).getTime();

  it("places a card at its start time", () => {
    const { top } = spanGeometry(ms("10:00"), ms("11:00"), options);

    expect(top).toBe(60);
  });

  it("sizes a card to its real duration", () => {
    const { height } = spanGeometry(ms("10:00"), ms("12:00"), options);

    expect(height).toBe(118); // two hours, less the 2px gap
  });

  it("floors a very short visit at a readable height", () => {
    const { height } = spanGeometry(ms("10:00"), ms("10:10"), options);

    expect(height).toBe(30);
  });

  it("scales with the row height", () => {
    const tall = spanGeometry(ms("10:00"), ms("11:00"), { ...options, rowHeight: 88 });

    expect(tall.top).toBe(88);
    expect(tall.height).toBe(86);
  });
});

describe("columnPlacement", () => {
  it("gives a lone card the full width", () => {
    expect(columnPlacement(0, 1).width).toBe("calc(100% - 6px)");
  });

  it("splits the day evenly across a cluster", () => {
    expect(columnPlacement(0, 3).left).toBe("calc(0% + 3px)");
    expect(columnPlacement(1, 3).width).toBe("calc(33.333333333333336% - 6px)");
  });
});

describe("clampToBookableDay", () => {
  const bounds = { dayStartHour: 7, dayEndHour: 19, minDuration: 10 };

  it("leaves a time inside the working day alone", () => {
    expect(clampToBookableDay(9 * 60, bounds)).toBe(540);
  });

  // The display window can start at 6 AM to show a legacy visit, but creating
  // one there must still be refused — describeSlotConflict and the database
  // trigger both enforce the booking bound, and the UI must not offer times
  // the server will reject.
  it("pulls a time before opening up to the start of the working day", () => {
    expect(clampToBookableDay(6 * 60, bounds)).toBe(7 * 60);
  });

  it("leaves room for the shortest possible visit before closing", () => {
    expect(clampToBookableDay(19 * 60, bounds)).toBe(19 * 60 - 10);
    expect(clampToBookableDay(23 * 60, bounds)).toBe(19 * 60 - 10);
  });
});

// The reason this module exists as a separate unit.
describe("pixel round-trip", () => {
  const GRID_START_HOURS = [6, 7, 9];
  const ROW_HEIGHTS = [56, 64, 72, 88];

  GRID_START_HOURS.forEach((gridStartHour) => {
    ROW_HEIGHTS.forEach((rowHeight) => {
      it(`recovers the exact minute at ${gridStartHour}:00 origin and ${rowHeight}px rows`, () => {
        for (let minutes = gridStartHour * 60; minutes < gridStartHour * 60 + 600; minutes += 10) {
          const pixels = minutesToPixel(minutes - gridStartHour * 60, rowHeight);

          expect(pixelToMinutes(pixels, { gridStartHour, rowHeight })).toBeCloseTo(minutes, 6);
        }
      });
    });
  });

  it("snaps a drop to the nearest ten minutes", () => {
    const options = { gridStartHour: 9, rowHeight: 60, snapTo: 10 };

    // 9:00 plus 34 pixels at 60px/hour is 9:34, which snaps down to 9:30.
    expect(pixelToMinutes(34, options)).toBe(9 * 60 + 30);
    // 9:36 snaps up to 9:40.
    expect(pixelToMinutes(36, options)).toBe(9 * 60 + 40);
  });

  it("lands a snapped drop back on the pixel it snapped to", () => {
    const options = { gridStartHour: 7, rowHeight: 72, snapTo: 15 };
    const snapped = pixelToMinutes(100, options);

    expect(snapped % 15).toBe(0);
    expect(pixelToMinutes(minutesToPixel(snapped - 7 * 60, 72), options)).toBe(snapped);
  });

  it("reports the top of the grid as the window's own start hour", () => {
    expect(pixelToMinutes(0, { gridStartHour: 9, rowHeight: 60 })).toBe(540);
    expect(pixelToMinutes(0, { gridStartHour: 6, rowHeight: 88 })).toBe(360);
  });
});
