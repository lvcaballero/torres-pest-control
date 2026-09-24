import {
  LEGEND_STATUSES,
  STATUS_COLORS,
  badgeStyle,
  contentTier,
  statusAccent,
  statusVisual,
} from "../appointmentTheme";
import { brand, status, surface } from "../../../styles/tokens";

const ALL_STATUSES = ["Pending", "Scheduled", "Confirmed", "Reschedule", "Completed", "Cancelled"];

// The handoff's rule: status is the only colour on the calendar. These pin
// the five treatments the legend documents.
describe("statusVisual", () => {
  it("covers every status the app can produce", () => {
    ALL_STATUSES.forEach((status) => {
      expect(statusVisual(status).edge).toBeTruthy();
    });
  });

  it("edges a confirmed visit in maroon on white", () => {
    expect(statusVisual("Confirmed")).toMatchObject({ edge: brand.base, fill: surface.panel, borderStyle: "solid" });
  });

  it("dashes a pending visit, which is not agreed yet", () => {
    expect(statusVisual("Pending").borderStyle).toBe("dashed");
  });

  // Pending and Reschedule used to be indistinguishable.
  it("fills a reschedule with amber so it differs from pending", () => {
    const pending = statusVisual("Pending");
    const reschedule = statusVisual("Reschedule");

    expect(reschedule.fill).not.toBe(pending.fill);
    expect(reschedule.borderStyle).not.toBe(pending.borderStyle);
  });

  it("fills a completed visit green", () => {
    expect(statusVisual("Completed")).toMatchObject({ edge: status.success, fill: status.successSurface });
  });

  it("strikes a cancelled visit and drops its fill", () => {
    expect(statusVisual("Cancelled")).toMatchObject({ strike: true, fill: "transparent", muted: true });
  });

  it("gives every legend status a distinct treatment", () => {
    const keys = LEGEND_STATUSES.map((entry) => {
      const visual = statusVisual(entry);
      return `${visual.edge}|${visual.fill}|${visual.borderStyle}|${visual.strike}`;
    });
    expect(new Set(keys).size).toBe(LEGEND_STATUSES.length);
  });

  it("falls back to the baseline for an unknown status", () => {
    expect(statusVisual("Something New")).toEqual(statusVisual("Confirmed"));
  });
});

describe("badgeStyle and statusAccent", () => {
  it("returns a colour pair for every status", () => {
    ALL_STATUSES.forEach((status) => {
      expect(STATUS_COLORS[status]).toHaveLength(2);
      expect(badgeStyle(status).background).toBeTruthy();
      expect(statusAccent(status)).toBeTruthy();
    });
  });

  it("falls back rather than returning undefined for an unknown status", () => {
    expect(badgeStyle("Nonsense")).toEqual(badgeStyle("Pending"));
    expect(statusAccent("Nonsense")).toBe(statusAccent("Confirmed"));
  });
});

describe("contentTier", () => {
  describe("by height, at full width", () => {
    it.each([
      [120, "full"],
      [88, "full"],
      [76, "full"],
      // A one-hour visit at a 72px row height, which is the most common card
      // on the board and must not lose its technician line.
      [70, "full"],
      [67, "medium"],
      [60, "medium"],
      [48, "medium"],
      [40, "compact"],
      [30, "compact"],
    ])("puts a %ipx card in the %s tier", (height, tier) => {
      expect(contentTier(height)).toBe(tier);
    });
  });

  // Width caps what height would otherwise allow: a long name in a narrow
  // card wraps and pushes the lines below it out of the box.
  describe("by width", () => {
    it("demotes a tall card sharing its slot with one other", () => {
      expect(contentTier(90)).toBe("full");
      expect(contentTier(90, 2)).toBe("medium");
    });

    it("gives a third-width card one line whatever its height", () => {
      expect(contentTier(200, 3)).toBe("compact");
      expect(contentTier(90, 3)).toBe("compact");
    });

    it("does not promote a short card just because it is wide", () => {
      expect(contentTier(40, 1)).toBe("compact");
      expect(contentTier(60, 2)).toBe("medium");
    });

    it("treats a single column as the default", () => {
      expect(contentTier(90, 1)).toBe(contentTier(90));
    });
  });

  it("never returns a tier the card cannot render", () => {
    [0, 1, 29, 1000].forEach((height) => {
      [1, 2, 3].forEach((columns) => {
        expect(["full", "medium", "compact"]).toContain(contentTier(height, columns));
      });
    });
  });
});
