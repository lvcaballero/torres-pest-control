import { concernsOf, inventoryAlerts, isBelowReorder, itemValue, sortByUrgency, watchFor } from "../inventoryWatch";

const now = new Date(2026, 8, 25, 9);
const item = (id, extra = {}) => ({ id, name: id, type: "MATERIAL", quantity: 10, reorderLevel: 2, status: "ACTIVE", cost: 5, ...extra });

describe("watchFor", () => {
  it("flags a chemical expiring within 30 days, from its local date", () => {
    expect(watchFor(item("demand", { type: "CHEMICAL", quantity: 0.8, expirationDate: "2026-10-05" }), now)).toMatchObject({
      tone: "danger",
      label: "Expires Oct 5",
      pill: true,
    });
  });

  it("notes a far-off expiry quietly", () => {
    expect(watchFor(item("termidor", { type: "CHEMICAL", expirationDate: "2027-08-01" }), now)).toMatchObject({ label: "Exp. Aug 2027", pill: false });
  });

  it("flags overdue equipment service as a warning, not an error", () => {
    expect(watchFor(item("sprayer", { type: "EQUIPMENT", nextMaintenanceDate: "2026-09-20", reorderLevel: null }), now)).toMatchObject({
      tone: "warning",
      label: "Service overdue · Sep 20",
    });
  });

  it("calls stock at or below the reorder level low, and zero out", () => {
    expect(watchFor(item("glue", { quantity: 2 }), now).label).toBe("Low stock");
    expect(watchFor(item("empty", { quantity: 0 }), now).label).toBe("Out of stock");
  });

  it("puts expiry ahead of low stock when an item has both", () => {
    const both = item("demand", { type: "CHEMICAL", quantity: 1, reorderLevel: 2, expirationDate: "2026-10-05" });
    expect(concernsOf(both, now).map((concern) => concern.key)).toEqual(["expiring", "low"]);
  });

  it("does not watch a disabled item", () => {
    expect(concernsOf(item("old", { quantity: 0, status: "DISABLED" }), now)).toEqual([]);
    expect(isBelowReorder(item("old", { quantity: 0, status: "DISABLED" }))).toBe(false);
  });

  it("ignores an expired chemical with none left", () => {
    expect(concernsOf(item("gone", { type: "CHEMICAL", quantity: 0, reorderLevel: null, expirationDate: "2026-01-01" }), now).map((c) => c.key)).toEqual(["out"]);
  });
});

describe("sortByUrgency and alerts", () => {
  const items = [
    item("fine"),
    item("disabled", { status: "DISABLED", quantity: 0 }),
    item("low", { quantity: 1 }),
    item("expiring", { type: "CHEMICAL", expirationDate: "2026-10-01" }),
    item("service", { type: "EQUIPMENT", nextMaintenanceDate: "2026-09-01" }),
  ];
  const losses = new Map([["fine", [{ reason: "MISSING", amount: 1 }]]]);

  it("puts the most urgent first and disabled items last", () => {
    expect(sortByUrgency(items, now, losses).map((entry) => entry.id)).toEqual(["expiring", "low", "service", "fine", "disabled"]);
  });

  it("counts each alert card", () => {
    expect(inventoryAlerts(items, now, losses)).toEqual({ low: 1, expiring: 1, maintenance: 1, losses: 1 });
  });

  it("values stock at current cost", () => {
    expect(itemValue(item("x", { quantity: 3, cost: 2.5 }))).toBe(7.5);
  });
});
