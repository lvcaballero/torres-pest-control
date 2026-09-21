// Contract tests for the shared style layer.
//
// Forty modules spread these objects onto elements, so the export names and
// their shapes are load-bearing in a way the values are not. These tests fail
// loudly if a restyle drops a key that a page is still reading, which is the
// failure mode a purely visual change would otherwise ship silently — nothing
// throws when `style={{ color: undefined }}` renders.
//
// They also pin the few rules the design language is actually defined by, so
// a well-meant "just add a shadow here" gets caught in review rather than
// after it has been copied into five more files.

import * as theme from "../theme";
import { brand, shadow, surface } from "../tokens";

/** Every key any live module reads off `colors`, per a grep of src/. */
const COLOR_KEYS_IN_USE = [
  "body",
  "brand",
  "brandInk",
  "brandLight",
  "danger",
  "ink",
  "line",
  "muted",
  "softLine",
  "success",
];

/** Style objects that get spread onto elements. */
const STYLE_OBJECT_EXPORTS = [
  "badge",
  "card",
  "dangerButton",
  "destructiveButton",
  "fieldGrid",
  "inputStyle",
  "invalidInputStyle",
  "pageShell",
  "primaryButton",
  "secondaryButton",
  "successButton",
];

describe("theme export contract", () => {
  it.each(COLOR_KEYS_IN_USE)("still exposes colors.%s", (key) => {
    expect(typeof theme.colors[key]).toBe("string");
    expect(theme.colors[key]).not.toHaveLength(0);
  });

  it.each(STYLE_OBJECT_EXPORTS)("still exports %s as a style object", (name) => {
    expect(theme[name]).toBeInstanceOf(Object);
  });

  it("keeps buttonWhen callable with its one-argument default", () => {
    expect(theme.buttonWhen(true).opacity).toBeLessThan(1);
    expect(theme.buttonWhen(false).opacity).toBe(1);
    expect(theme.buttonWhen(true).cursor).toBe("default");
  });

  it("lets buttonWhen disable any base style, not just the primary", () => {
    const disabled = theme.buttonWhen(true, theme.secondaryButton);

    expect(disabled.border).toBe(theme.secondaryButton.border);
    expect(disabled.opacity).toBeLessThan(1);
  });

  it("keeps dangerButton as an alias so existing call sites survive", () => {
    expect(theme.dangerButton).toBe(theme.destructiveButton);
  });
});

describe("the brand is not negotiable", () => {
  it("keeps the three brand values exactly", () => {
    expect(theme.colors.brand).toBe("#7f1111");
    expect(theme.colors.brandLight).toBe("#bf3e3e");
    expect(theme.colors.brandInk).toBe("#8b1e1e");
  });

  it("uses the brand as the fill of the single primary action", () => {
    expect(theme.primaryButton.background).toBe(brand.base);
  });
});

describe("design language invariants", () => {
  // Ambrook builds hierarchy from surface temperature and hairline borders.
  // A shadow on a card means someone reached for elevation instead.
  it.each(["card", "inputStyle", "primaryButton", "secondaryButton"])(
    "%s carries no drop shadow",
    (name) => {
      expect(theme[name].boxShadow).toBe(shadow.none);
    }
  );

  it("uses parchment, not white, as the page canvas", () => {
    expect(theme.appBackground).toBe(surface.canvas);
    expect(theme.appBackground).not.toBe("#ffffff");
  });

  it("keeps the page canvas flat rather than a gradient", () => {
    expect(theme.appBackground).not.toMatch(/gradient/);
  });

  it("keeps buttons subtly rounded rather than pill-shaped", () => {
    expect(theme.primaryButton.borderRadius).not.toBe("9999px");
    expect(theme.secondaryButton.borderRadius).toBe(theme.primaryButton.borderRadius);
  });

  it("reserves the pill radius for badges, which read as stamps", () => {
    expect(theme.badge.borderRadius).toBe("9999px");
  });

  it("sets headings at weight 500, the reference's signature restraint", () => {
    expect(theme.heading.fontWeight).toBe(500);
    expect(theme.subheading.fontWeight).toBe(500);
  });

  it("tracks the eyebrow wide and uppercases it", () => {
    expect(theme.eyebrow.textTransform).toBe("uppercase");
    expect(parseFloat(theme.eyebrow.letterSpacing)).toBeGreaterThan(0);
  });
});
