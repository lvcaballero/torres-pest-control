import {
  daysUntil,
  describeExpiry,
  expiringItems,
  expiryStatus,
  lotsOnHand,
  nearestExpiryOnHand,
} from "../expiry";

const TODAY = "2026-09-25";
const item = { id: "i1", type: "CHEMICAL", quantity: 8 };
const delivery = (id, fields) => ({ id, itemId: "i1", movementType: "IN", quantityDelta: 5, ...fields });

const movements = [
  delivery("old", { movementDate: "2026-01-10", expirationDate: "2026-10-01", batchNumber: "L24-0917" }),
  delivery("new", { movementDate: "2026-06-02", expirationDate: "2027-12-01", batchNumber: "L25-0142" }),
  { id: "out", itemId: "i1", movementType: "OUT", quantityDelta: -2, movementDate: "2026-07-01" },
];

describe("lotsOnHand", () => {
  it("assumes first-in-first-out: the newest deliveries are what is left", () => {
    const { lots, unaccounted } = lotsOnHand(item, movements);
    expect(lots.map((lot) => [lot.movementId, lot.quantity])).toEqual([["new", 5], ["old", 3]]);
    expect(unaccounted).toBe(0);
  });

  it("drops an older delivery once newer ones cover the quantity", () => {
    const { lots } = lotsOnHand({ ...item, quantity: 4 }, movements);
    expect(lots.map((lot) => lot.movementId)).toEqual(["new"]);
  });

  it("reports stock no delivery explains", () => {
    expect(lotsOnHand({ ...item, quantity: 12 }, movements).unaccounted).toBe(2);
  });

  it("breaks same-day ties by creation time", () => {
    const sameDay = [
      delivery("a", { movementDate: "2026-06-02", createdAt: "2026-06-02T01:00:00Z" }),
      delivery("b", { movementDate: "2026-06-02", createdAt: "2026-06-02T05:00:00Z" }),
    ];
    expect(lotsOnHand({ ...item, quantity: 5 }, sameDay).lots[0].movementId).toBe("b");
  });
});

describe("nearestExpiryOnHand", () => {
  it("finds the soonest date among lots still on the shelf", () => {
    expect(nearestExpiryOnHand(item, movements)).toEqual({ date: "2026-10-01", batchNumber: "L24-0917", legacy: false });
  });

  it("ignores a lot that has been used up", () => {
    expect(nearestExpiryOnHand({ ...item, quantity: 4 }, movements).date).toBe("2027-12-01");
  });

  it("is null when nothing is in stock", () => {
    expect(nearestExpiryOnHand({ ...item, quantity: 0 }, movements)).toBeNull();
  });

  it("falls back on the item's legacy date only when no delivery was ever dated", () => {
    const undated = [delivery("x", { movementDate: "2026-01-10" })];
    const legacyItem = { ...item, quantity: 3, expirationDate: "2026-11-30T00:00:00+00:00" };
    expect(nearestExpiryOnHand(legacyItem, undated)).toEqual({ date: "2026-11-30", batchNumber: "", legacy: true });
    expect(nearestExpiryOnHand({ ...legacyItem, quantity: 4 }, movements).legacy).toBe(false);
  });
});

describe("expiryStatus / daysUntil / describeExpiry", () => {
  it("classifies against today", () => {
    expect(expiryStatus("2026-09-24", { today: TODAY })).toBe("EXPIRED");
    expect(expiryStatus("2026-09-25", { today: TODAY })).toBe("SOON");
    expect(expiryStatus("2026-10-25", { today: TODAY })).toBe("SOON");
    expect(expiryStatus("2026-10-26", { today: TODAY })).toBe("OK");
    expect(expiryStatus("", { today: TODAY })).toBe("");
  });

  it("counts whole days", () => {
    expect(daysUntil("2026-10-01", TODAY)).toBe(6);
    expect(describeExpiry("2026-09-24", TODAY)).toBe("Expired 1 day ago");
    expect(describeExpiry("2026-09-25", TODAY)).toBe("Expires today");
    expect(describeExpiry("2026-10-01", TODAY)).toBe("Expires in 6 days");
  });
});

describe("expiringItems", () => {
  it("lists only chemicals that are expired or expiring soon", () => {
    const inventory = [item, { id: "i2", type: "EQUIPMENT", quantity: 1, expirationDate: "2026-01-01" }];
    const result = expiringItems(inventory, movements, { today: TODAY });
    expect([...result.keys()]).toEqual(["i1"]);
    expect(result.get("i1").status).toBe("SOON");
  });
});
