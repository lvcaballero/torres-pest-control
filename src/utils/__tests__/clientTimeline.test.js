import { clientVisits, currentPlan, directionsUrl, lifetimeValue, nextVisit, telUrl, timelineEvents, visitDatesByClient } from "../clientTimeline";

const now = new Date(2026, 8, 25, 12, 0);
const at = (month, day, hour = 9) => new Date(2026, month, day, hour).toISOString();
const visit = (id, scheduledAt, extra = {}) => ({ id, clientId: "c1", scheduledAt, durationMinutes: 60, status: "Confirmed", reportSubmitted: false, price: "", ...extra });

const visits = [
  visit("sep16", at(8, 16), { status: "Completed", reportSubmitted: true, reportSubmittedAt: at(8, 16, 11), price: 12500, serviceFrequency: "Quarterly" }),
  visit("jun12", at(5, 12), { status: "Completed", reportSubmitted: true, price: "3500", serviceFrequency: "Monthly" }),
  visit("sep20", at(8, 20)), // ended, no report
  visit("aug1", at(7, 1), { status: "Cancelled", price: 9000 }),
  visit("dec15", at(11, 15), { serviceFrequency: "Quarterly" }),
  visit("oct1", at(9, 1), { status: "Pending" }),
  { ...visit("other", at(8, 1)), clientId: "c2" },
];

describe("clientVisits", () => {
  it("returns only this client's visits, newest first", () => {
    expect(clientVisits(visits, "c1").map((entry) => entry.id)).toEqual(["dec15", "oct1", "sep20", "sep16", "aug1", "jun12"]);
  });
});

describe("nextVisit", () => {
  it("is the soonest live visit still to happen", () => {
    expect(nextVisit(clientVisits(visits, "c1"), now).id).toBe("oct1");
  });

  it("is null when nothing is booked", () => {
    expect(nextVisit([visits[0]], now)).toBeNull();
  });
});

describe("lifetimeValue", () => {
  it("adds prices of visits that happened, not cancelled or future ones", () => {
    expect(lifetimeValue(clientVisits(visits, "c1"))).toEqual({ total: 16000, visits: 2 });
  });
});

describe("currentPlan", () => {
  it("takes the frequency of the most recent visit that has one", () => {
    expect(currentPlan(clientVisits(visits, "c1"))).toBe("Quarterly");
    expect(currentPlan([])).toBe("");
  });
});

describe("timelineEvents", () => {
  const client = {
    id: "c1",
    createdAt: at(2, 3),
    documents: [{ id: "d1", name: "permit.pdf", category: "PERMIT", uploadedAt: at(8, 19, 14) }],
  };

  it("mixes reports, missed visits, cancellations, documents and creation, newest first", () => {
    const events = timelineEvents(client, clientVisits(visits, "c1"), now);
    expect(events.map((event) => event.key)).toEqual([
      "missed-sep20",
      "document-d1",
      "report-sep16",
      "cancelled-aug1",
      "report-jun12",
      "created",
    ]);
  });

  it("leaves visits still ahead out of the history", () => {
    const keys = timelineEvents(client, clientVisits(visits, "c1"), now).map((event) => event.key);
    expect(keys.some((key) => key.includes("dec15") || key.includes("oct1"))).toBe(false);
  });
});

describe("links", () => {
  it("builds a Google Maps search and a dialable number", () => {
    expect(directionsUrl("10 Katipunan Ave, Quezon City")).toBe("https://www.google.com/maps/search/?api=1&query=10%20Katipunan%20Ave%2C%20Quezon%20City");
    expect(telUrl("0917 800 1000")).toBe("tel:09178001000");
    expect(telUrl("")).toBe("");
  });
});

describe("visitDatesByClient", () => {
  it("finds each client's most recent and next visit, ignoring cancellations", () => {
    const dates = visitDatesByClient(visits, now);
    expect(new Date(dates.get("c1").last).getDate()).toBe(20);
    expect(new Date(dates.get("c1").next).getMonth()).toBe(9);
    expect(dates.get("c2")).toEqual({ last: new Date(at(8, 1)).getTime(), next: null });
  });
});
