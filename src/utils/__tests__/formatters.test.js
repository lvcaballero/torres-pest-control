import { formatDateTime, formatLastLogin, formatShortDate, plural } from "../formatters";

describe("plural", () => {
  it.each([
    [0, "0 visits"],
    [1, "1 visit"],
    [2, "2 visits"],
  ])("counts %i", (count, expected) => {
    expect(plural(count, "visit")).toBe(expected);
  });

  it("takes an irregular plural", () => {
    expect(plural(3, "activity", "activities")).toBe("3 activities");
    expect(plural(1, "activity", "activities")).toBe("1 activity");
  });
});

describe("date helpers", () => {
  const value = "2026-09-24T08:00:05";

  // The Users page used to print "9/24/2026, 8:00:05 AM".
  it("never shows seconds", () => {
    expect(formatDateTime(value)).not.toMatch(/:05/);
    expect(formatLastLogin(value)).not.toMatch(/:05/);
  });

  it("formats a short date with no year", () => {
    expect(formatShortDate(value)).toMatch(/Sep/);
    expect(formatShortDate(value)).not.toMatch(/2026/);
  });

  it("falls back for empty values", () => {
    expect(formatShortDate("")).toBe("—");
    expect(formatLastLogin(null)).toBe("Never");
  });
});
