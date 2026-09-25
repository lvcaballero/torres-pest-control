import { reportsDue, serviceMix, serviceMixThisMonth, signatureState, weekWindow } from "../dashboardMetrics";

// Friday 25 Sep 2026, 9:12 AM — the handoff's example day.
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

describe("reportsDue", () => {
  const appointments = [
    visit("wed", at(23, 9)),
    visit("fri-early", at(25, 7)), // ended 8:00, before now
    visit("fri-now", at(25, 9)), // still in progress at 9:12
    visit("sun", at(27, 10)), // the handoff's "Sunday visit on a Friday"
    visit("filed", at(24, 9), { reportSubmitted: true }),
    visit("cancelled", at(22, 9), { status: "Cancelled" }),
    visit("someone-else", at(22, 9), { technicianId: "ramon", technicianIds: ["ramon"] }),
    visit("last-week", at(18, 9)),
  ];

  it("lists only this week's visits that have ended without a report", () => {
    expect(reportsDue(appointments, "jun", now).map((entry) => entry.id)).toEqual(["wed", "fri-early"]);
  });

  it("never includes a visit that hasn't finished yet", () => {
    const ids = reportsDue(appointments, "jun", now).map((entry) => entry.id);
    expect(ids).not.toContain("sun");
    expect(ids).not.toContain("fri-now");
  });

  it("counts a crew member, not just the lead", () => {
    const crew = [visit("crew", at(23, 9), { technicianId: "ramon", technicianIds: ["ramon", "jun"] })];
    expect(reportsDue(crew, "jun", now)).toHaveLength(1);
  });
});

describe("signatureState", () => {
  // The contradiction in the handoff: "signed by Store Manager" beside UNSIGNED.
  it("does not treat a typed customer name as a signature", () => {
    expect(signatureState({ reportSubmitted: true, customerName: "Store Manager", signaturePath: "" })).toBe("No signature");
  });

  it("calls a report with a signature image signed", () => {
    expect(signatureState({ reportSubmitted: true, customerName: "", signaturePath: "sig/a.png" })).toBe("Signed");
  });

  it("says the report is due when there is none", () => {
    expect(signatureState({ reportSubmitted: false })).toBe("Report due");
  });
});

describe("serviceMix", () => {
  const window = weekWindow(now);

  it("groups by the service as booked, not the pest concern", () => {
    const rows = serviceMix(
      [
        visit("a", at(22, 9), { serviceType: "General Pest Control", pestConcern: "Rodents" }),
        visit("b", at(23, 9), { serviceType: "General Pest Control", pestConcern: "Cockroaches" }),
        visit("c", at(24, 9), { serviceType: "Termite Baiting", pestConcern: "Termites" }),
        visit("d", at(24, 11), { serviceType: "", pestConcern: "Flies" }),
      ],
      window
    );

    expect(rows).toEqual([
      { label: "General Pest Control", count: 2 },
      { label: "Termite Baiting", count: 1 },
      { label: "Unspecified service", count: 1 },
    ]);
  });

  it("leaves cancelled visits out", () => {
    expect(serviceMix([visit("x", at(22, 9), { status: "Cancelled", serviceType: "X" })], window)).toEqual([]);
  });

  it("keeps the monthly helper on the same rule", () => {
    expect(typeof serviceMixThisMonth([])).toBe("object");
  });
});
