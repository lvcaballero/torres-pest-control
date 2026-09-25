import {
  adjustAmount,
  canStart,
  clearDraft,
  dayPlan,
  leadsCrew,
  loadDraft,
  materialsFromService,
  minutesOnSite,
  saveDraft,
  stepFor,
  workLeftLabel,
} from "../techDay";

const now = new Date(2026, 8, 25, 9, 12);
const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString();
const visit = (id, scheduledAt, extra = {}) => ({
  id,
  scheduledAt,
  durationMinutes: 60,
  status: "Confirmed",
  technicianId: "jun",
  technicianIds: ["jun"],
  reportSubmitted: false,
  ...extra,
});

describe("dayPlan", () => {
  const appointments = [
    visit("done", at(25, 8), { status: "Completed", reportSubmitted: true }),
    visit("port", at(25, 10)),
    visit("farm", at(25, 14), { technicianIds: ["jun", "paolo"], durationMinutes: 90 }),
    visit("hall", at(25, 16, 30), { durationMinutes: 90 }),
    visit("cancelled", at(25, 12), { status: "Cancelled" }),
    visit("tomorrow", at(26, 9)),
    visit("ramon", at(25, 11), { technicianId: "ramon", technicianIds: ["ramon"] }),
  ];

  it("splits today into done, up next and later, soonest first", () => {
    const plan = dayPlan(appointments, "jun", now);
    expect(plan.done.map((entry) => entry.id)).toEqual(["done"]);
    expect(plan.upNext.id).toBe("port");
    expect(plan.later.map((entry) => entry.id)).toEqual(["farm", "hall"]);
    expect(plan.minutesLeft).toBe(240);
  });

  it("puts a visit already in progress up next", () => {
    const started = appointments.map((entry) => (entry.id === "farm" ? { ...entry, status: "In progress" } : entry));
    expect(dayPlan(started, "jun", now).upNext.id).toBe("farm");
  });

  it("has nothing up next when the day is done", () => {
    expect(dayPlan([appointments[0]], "jun", now).upNext).toBeNull();
  });
});

describe("labels and rules", () => {
  it("rounds the work left to the half hour", () => {
    expect(workLeftLabel(240)).toBe("about 4 h of work");
    expect(workLeftLabel(290)).toBe("about 5 h of work");
    expect(workLeftLabel(45)).toBe("about 45 min of work");
    expect(workLeftLabel(0)).toBe("");
  });

  it("only mentions leading when there is a crew", () => {
    expect(leadsCrew(visit("a", at(25, 9), { technicianIds: ["jun", "paolo"] }), "jun")).toBe(true);
    expect(leadsCrew(visit("a", at(25, 9)), "jun")).toBe(false);
    expect(leadsCrew(visit("a", at(25, 9), { technicianIds: ["paolo", "jun"] }), "jun")).toBe(false);
  });

  it("counts minutes on site from started_at", () => {
    expect(minutesOnSite({ startedAt: new Date(2026, 8, 25, 8, 35).toISOString() }, now)).toBe(37);
    expect(minutesOnSite({ startedAt: "" }, now)).toBeNull();
  });

  it("starts only today's open visits", () => {
    expect(canStart(visit("a", at(25, 10)), now)).toBe(true);
    expect(canStart(visit("a", at(26, 10)), now)).toBe(false);
    expect(canStart(visit("a", at(25, 10), { status: "In progress" }), now)).toBe(false);
    expect(canStart(visit("a", at(25, 10), { status: "Cancelled" }), now)).toBe(false);
  });
});

describe("materials", () => {
  it("steps pieces by one and liquids by a tenth, without float noise", () => {
    expect(stepFor("pc")).toBe(1);
    expect(stepFor("L")).toBe(0.1);
    expect(adjustAmount(0.2, 0.1, 0.1)).toBe(0.3);
    expect(adjustAmount(0, -1, 1)).toBe(0);
  });

  it("prefills from the service profile, skipping disabled or missing items", () => {
    const service = { materials: [{ itemId: "i1", defaultAmount: 0.5 }, { itemId: "i2", defaultAmount: 6 }, { itemId: "gone", defaultAmount: 1 }] };
    const inventory = [{ id: "i1", status: "ACTIVE" }, { id: "i2", status: "DISABLED" }];
    expect(materialsFromService(service, inventory)).toEqual([{ itemId: "i1", amount: 0.5 }]);
  });
});

describe("draft on the device", () => {
  beforeEach(() => localStorage.clear());

  it("saves, reloads and clears a visit's draft", () => {
    saveDraft("a1", { findings: "Burrows along the fence" });
    expect(loadDraft("a1").findings).toBe("Burrows along the fence");
    clearDraft("a1");
    expect(loadDraft("a1")).toBeNull();
  });
});
