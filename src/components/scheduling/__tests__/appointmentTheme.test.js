import {
  HATCH_IMAGE,
  STATUS_COLORS,
  TECHNICIAN_PALETTE,
  UNASSIGNED_COLOR,
  badgeStyle,
  contentTier,
  statusAccent,
  statusVisual,
  technicianColorMap,
} from "../appointmentTheme";

const ALL_STATUSES = ["Pending", "Scheduled", "Confirmed", "Reschedule", "Completed", "Cancelled"];

describe("technicianColorMap", () => {
  const techs = (count) => Array.from({ length: count }, (_, i) => ({ id: `t${i}` }));

  it("assigns a distinct colour to each technician", () => {
    const map = technicianColorMap(techs(3));

    expect(new Set([...map.values()].map((c) => c.fill)).size).toBe(3);
  });

  it("wraps around once the palette runs out", () => {
    const map = technicianColorMap(techs(8));

    expect(map.get("t6")).toEqual(map.get("t0"));
    expect(map.get("t7")).toEqual(map.get("t1"));
  });

  // Colour is keyed off list order so it stays stable between renders and
  // across the week rather than shuffling when the list re-fetches.
  it("is stable for the same list", () => {
    expect(technicianColorMap(techs(4)).get("t2")).toEqual(technicianColorMap(techs(4)).get("t2"));
  });

  it("handles an empty technician list", () => {
    expect(technicianColorMap([]).size).toBe(0);
  });

  it("keeps unassigned visually outside the technician palette", () => {
    expect(TECHNICIAN_PALETTE.map((c) => c.fill)).not.toContain(UNASSIGNED_COLOR.fill);
  });
});

describe("statusVisual", () => {
  it("covers every status the app can produce", () => {
    ALL_STATUSES.forEach((status) => {
      expect(statusVisual(status)).toBeDefined();
    });
  });

  // The whole point of the rewrite: one 1px border style was not enough to
  // tell these apart on a small card.
  it("gives every non-default status more than one distinguishing cue", () => {
    ["Pending", "Reschedule", "Completed", "Cancelled"].forEach((status) => {
      const visual = statusVisual(status);
      const cues = [
        visual.glyph,
        visual.hatch,
        visual.strike,
        visual.mutedText,
        visual.railColor,
        visual.borderWidth > 1,
        visual.tint,
      ].filter(Boolean);

      expect(cues.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("strikes through a cancelled visit and fades it", () => {
    const visual = statusVisual("Cancelled");

    expect(visual.strike).toBe(true);
    expect(visual.opacity).toBeLessThan(1);
  });

  // `filter: saturate(0.55)` read as a rendering fault rather than as "done".
  it("tints a completed visit rather than desaturating it", () => {
    const visual = statusVisual("Completed");

    expect(visual.tint).toBeTruthy();
    expect(visual.opacity).toBe(1);
    expect(visual.strike).toBe(false);
  });

  it("hatches a pending visit, which reads at any size", () => {
    expect(statusVisual("Pending").hatch).toBe(true);
    expect(HATCH_IMAGE).toMatch(/repeating-linear-gradient/);
  });

  it("gives a reschedule a heavier border and its own glyph", () => {
    const visual = statusVisual("Reschedule");

    expect(visual.borderWidth).toBe(2);
    expect(visual.glyph).toBe("reschedule");
  });

  it("leaves the confirmed baseline showing the technician's own rail", () => {
    const visual = statusVisual("Confirmed");

    expect(visual.railColor).toBeNull();
    expect(visual.glyph).toBeNull();
    expect(visual.opacity).toBe(1);
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
    expect(statusAccent("Nonsense")).toBe(statusAccent("Pending"));
  });
});

describe("contentTier", () => {
  it.each([
    [120, "full"],
    [88, "full"],
    [76, "full"],
    [60, "medium"],
    [48, "medium"],
    [40, "compact"],
    [30, "compact"],
  ])("puts a %ipx card in the %s tier", (height, tier) => {
    expect(contentTier(height)).toBe(tier);
  });

  it("never returns a tier the card cannot render", () => {
    [0, 1, 29, 1000].forEach((height) => {
      expect(["full", "medium", "compact"]).toContain(contentTier(height));
    });
  });
});
