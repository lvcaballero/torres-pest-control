// Unit tests for the pure scheduling helpers.
//
// These exist because the week calendar's pixel math is about to be
// parameterised (see calendarGeometry), and the column-packing and conflict
// rules underneath it had no coverage at all. Everything here is pure: no
// React, no Supabase, no clock dependency beyond local-time parsing.
//
// Dates are written without a trailing `Z` on purpose. `startOf` and
// `describeSlotConflict` both read local hours, so a UTC literal would make
// these tests pass or fail depending on the machine's timezone.

import {
  allowedNextStatuses,
  bookableTechnicians,
  moveSteps,
  appointmentsOverlap,
  busyTechnicianIds,
  canTransition,
  crewOf,
  describeSlotConflict,
  findTechnicianConflicts,
  isAssignedTo,
  layoutDayAppointments,
} from "../scheduling";

const DAY = "2026-09-22";

/** An appointment at `time` on the fixed test day. */
const at = (id, time, durationMinutes = 60, extra = {}) => ({
  id,
  scheduledAt: `${DAY}T${time}:00`,
  durationMinutes,
  status: "Confirmed",
  ...extra,
});

/** `{ id: column }` for every placed appointment, for terse assertions. */
const columnsById = (placed) =>
  Object.fromEntries(placed.map((entry) => [entry.appointment.id, entry.column]));

describe("layoutDayAppointments", () => {
  it("gives a single appointment the full width", () => {
    const { placed, overflow } = layoutDayAppointments([at("a", "09:00")]);

    expect(overflow).toHaveLength(0);
    expect(placed).toHaveLength(1);
    expect(placed[0].columns).toBe(1);
    expect(placed[0].column).toBe(0);
  });

  it("keeps non-overlapping appointments at full width", () => {
    const { placed } = layoutDayAppointments([at("a", "09:00"), at("b", "14:00")]);

    expect(placed.map((entry) => entry.columns)).toEqual([1, 1]);
  });

  // The regression the function's own doc comment calls out: counting columns
  // per day rather than per cluster made a lone afternoon visit one third wide
  // just because the morning was busy.
  it("does not narrow a lone afternoon visit because the morning is crowded", () => {
    const { placed } = layoutDayAppointments([
      at("morning-1", "09:00"),
      at("morning-2", "09:00"),
      at("morning-3", "09:00"),
      at("afternoon", "16:00"),
    ]);

    const lone = placed.find((entry) => entry.appointment.id === "afternoon");
    expect(lone.columns).toBe(1);
    expect(placed.filter((entry) => entry.appointment.id.startsWith("morning"))
      .every((entry) => entry.columns === 3)).toBe(true);
  });

  it("splits a three-deep cluster into three columns", () => {
    const { placed, overflow } = layoutDayAppointments([
      at("a", "09:00"),
      at("b", "09:00"),
      at("c", "09:00"),
    ]);

    expect(overflow).toHaveLength(0);
    expect(placed.map((entry) => entry.columns)).toEqual([3, 3, 3]);
    expect(new Set(placed.map((entry) => entry.column))).toEqual(new Set([0, 1, 2]));
  });

  it("reuses a column once its occupant has ended", () => {
    // 9-10 and 10-11 can share a column; 9:30-10:30 overlaps both and cannot.
    const { placed } = layoutDayAppointments([
      at("first", "09:00"),
      at("late", "10:00"),
      at("straddling", "09:30"),
    ]);

    expect(columnsById(placed)).toEqual({ first: 0, straddling: 1, late: 0 });
    expect(placed.every((entry) => entry.columns === 2)).toBe(true);
  });

  it("collects everything past maxColumns behind one overflow tile", () => {
    const { placed, overflow } = layoutDayAppointments(
      ["a", "b", "c", "d", "e"].map((id) => at(id, "09:00"))
    );

    // Two columns are kept so the overflow tile has the third to itself.
    expect(placed).toHaveLength(2);
    expect(placed.every((entry) => entry.columns === 3)).toBe(true);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].items).toHaveLength(3);
    expect(overflow[0].column).toBe(2);
    expect(overflow[0].columns).toBe(3);
  });

  it("honours a custom maxColumns", () => {
    const { placed, overflow } = layoutDayAppointments(
      ["a", "b", "c"].map((id) => at(id, "09:00")),
      { maxColumns: 2 }
    );

    expect(placed).toHaveLength(1);
    expect(overflow[0].items).toHaveLength(2);
  });

  it("returns empty results for an empty day", () => {
    expect(layoutDayAppointments([])).toEqual({ placed: [], overflow: [] });
  });
});

describe("appointmentsOverlap", () => {
  it("treats touching appointments as non-overlapping", () => {
    expect(appointmentsOverlap(at("a", "09:00"), at("b", "10:00"))).toBe(false);
  });

  it("detects a partial overlap in both directions", () => {
    const a = at("a", "09:00");
    const b = at("b", "09:30");

    expect(appointmentsOverlap(a, b)).toBe(true);
    expect(appointmentsOverlap(b, a)).toBe(true);
  });
});

describe("describeSlotConflict", () => {
  it("accepts a valid slot inside the working day", () => {
    expect(describeSlotConflict([], at("new", "09:00"))).toBeNull();
  });

  it("rejects an unparseable date", () => {
    expect(describeSlotConflict([], { scheduledAt: "not a date", durationMinutes: 60 }))
      .toMatch(/valid date and time/i);
  });

  it("rejects a missing duration", () => {
    expect(describeSlotConflict([], at("new", "09:00", 0))).toMatch(/how long/i);
  });

  it("rejects a start before the working day opens", () => {
    expect(describeSlotConflict([], at("new", "06:00"))).toMatch(/inside the working day/i);
  });

  it("rejects a start at or after the working day closes", () => {
    expect(describeSlotConflict([], at("new", "19:00"))).toMatch(/inside the working day/i);
  });

  it("rejects a visit that runs past closing even though it starts in time", () => {
    expect(describeSlotConflict([], at("new", "18:00", 90))).toMatch(/runs past/i);
  });

  it("reports a clash with the same technician", () => {
    const existing = at("existing", "09:00", 60, { technicianId: "tech-1" });
    const candidate = at("new", "09:30", 60, { technicianId: "tech-1" });

    expect(describeSlotConflict([existing], candidate)).toMatch(/already booked/i);
  });

  it("allows two technicians to work the same slot", () => {
    const existing = at("existing", "09:00", 60, { technicianId: "tech-1" });
    const candidate = at("new", "09:00", 60, { technicianId: "tech-2" });

    expect(describeSlotConflict([existing], candidate)).toBeNull();
  });

  it("never clashes an unassigned visit", () => {
    const existing = at("existing", "09:00", 60, { technicianId: "tech-1" });

    expect(describeSlotConflict([existing], at("new", "09:00"))).toBeNull();
  });

  it("ignores a cancelled appointment when looking for clashes", () => {
    const cancelled = at("existing", "09:00", 60, { technicianId: "tech-1", status: "Cancelled" });
    const candidate = at("new", "09:00", 60, { technicianId: "tech-1" });

    expect(describeSlotConflict([cancelled], candidate)).toBeNull();
  });

  it("does not clash an appointment with itself", () => {
    const existing = at("same", "09:00", 60, { technicianId: "tech-1" });

    expect(describeSlotConflict([existing], existing)).toBeNull();
  });
});

describe("findTechnicianConflicts / busyTechnicianIds", () => {
  const booked = at("booked", "09:00", 60, { technicianId: "tech-1" });
  const free = at("free", "14:00", 60, { technicianId: "tech-2" });

  it("finds only the overlapping appointment for that technician", () => {
    const clashes = findTechnicianConflicts([booked, free], at("new", "09:30", 60, { technicianId: "tech-1" }));

    expect(clashes.map((entry) => entry.id)).toEqual(["booked"]);
  });

  it("lists every technician busy during the window", () => {
    const alsoBooked = at("also", "09:00", 60, { technicianId: "tech-3" });

    expect(busyTechnicianIds([booked, free, alsoBooked], at("new", "09:30")))
      .toEqual(new Set(["tech-1", "tech-3"]));
  });
});

// Migration 041: an appointment can carry a crew, and technicianId is only its
// lead. Every "is this person on this job" question has to ask the crew.
describe("crewOf / isAssignedTo", () => {
  it("reads a crew when there is one", () => {
    expect(crewOf({ technicianIds: ["t1", "t2"], technicianId: "t1" })).toEqual(["t1", "t2"]);
  });

  it("falls back to the lead for a row that has not been re-read yet", () => {
    expect(crewOf({ technicianId: "t1" })).toEqual(["t1"]);
    expect(crewOf({ technicianIds: [], technicianId: "t1" })).toEqual(["t1"]);
  });

  it("is empty for an unassigned visit", () => {
    expect(crewOf({})).toEqual([]);
    expect(isAssignedTo({}, "t1")).toBe(false);
  });

  it("counts a second technician as assigned, not just the lead", () => {
    const job = { technicianIds: ["t1", "t2"] };
    expect(isAssignedTo(job, "t2")).toBe(true);
    expect(isAssignedTo(job, "t3")).toBe(false);
    expect(isAssignedTo(job, "")).toBe(false);
  });
});

describe("conflicts across a crew", () => {
  it("clashes when any one member is double-booked", () => {
    const existing = at("existing", "09:00", 60, { technicianIds: ["t2"] });
    const candidate = at("new", "09:30", 60, { technicianIds: ["t1", "t2"] });

    expect(findTechnicianConflicts([existing], candidate).map((entry) => entry.id)).toEqual(["existing"]);
  });

  it("does not clash when the crews are disjoint", () => {
    const existing = at("existing", "09:00", 60, { technicianIds: ["t3"] });
    const candidate = at("new", "09:30", 60, { technicianIds: ["t1", "t2"] });

    expect(findTechnicianConflicts([existing], candidate)).toEqual([]);
  });

  it("reports every member of an overlapping crew as busy", () => {
    const existing = at("existing", "09:00", 60, { technicianIds: ["t1", "t2"] });

    expect(busyTechnicianIds([existing], at("new", "09:30")))
      .toEqual(new Set(["t1", "t2"]));
  });
});

describe("canTransition / allowedNextStatuses", () => {
  it("always allows a no-op transition", () => {
    expect(canTransition("Completed", "Completed")).toBe(true);
  });

  it("treats Completed as terminal", () => {
    expect(canTransition("Completed", "Pending")).toBe(false);
    expect(allowedNextStatuses("Completed")).toEqual(["Completed"]);
  });

  it("only lets a cancelled appointment be rescheduled", () => {
    expect(canTransition("Cancelled", "Reschedule")).toBe(true);
    expect(canTransition("Cancelled", "Confirmed")).toBe(false);
  });

  it("allows the ordinary confirm and reschedule moves", () => {
    expect(canTransition("Pending", "Confirmed")).toBe(true);
    expect(canTransition("Confirmed", "Reschedule")).toBe(true);
  });

  it("always offers the current status first", () => {
    expect(allowedNextStatuses("Pending")[0]).toBe("Pending");
  });

  it("refuses a status it has never heard of", () => {
    expect(canTransition("Nonsense", "Confirmed")).toBe(false);
  });
});

describe("moveSteps", () => {
  const visit = { id: "a1", scheduledAt: "2026-09-25T09:00:00", status: "Pending" };

  // The bug: a drop saved every visit as Confirmed.
  it("keeps a pending visit pending after the move", () => {
    const steps = moveSteps(visit, "2026-09-26T10:00:00");

    expect(steps.map((step) => step.status)).toEqual(["Reschedule", "Pending"]);
    expect(steps.at(-1).scheduledAt).toBe("2026-09-26T10:00:00");
  });

  it("keeps a confirmed visit confirmed", () => {
    expect(moveSteps({ ...visit, status: "Confirmed" }, "2026-09-26T10:00:00").at(-1).status).toBe("Confirmed");
  });

  it("does not change the time on the Reschedule hop", () => {
    expect(moveSteps(visit, "2026-09-26T10:00:00")[0].scheduledAt).toBe(visit.scheduledAt);
  });

  it("needs one write for a visit already in Reschedule", () => {
    const steps = moveSteps({ ...visit, status: "Reschedule" }, "2026-09-26T10:00:00");
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe("Reschedule");
  });

  it("only uses transitions the database allows", () => {
    ["Pending", "Confirmed", "Reschedule"].forEach((status) => {
      let from = status;
      moveSteps({ ...visit, status }, "2026-09-26T10:00:00").forEach((step) => {
        expect(canTransition(from, step.status)).toBe(true);
        from = step.status;
      });
    });
  });
});

describe("bookableTechnicians", () => {
  const technicians = [
    { id: "jun", status: "ACTIVE" },
    { id: "ben", status: "INACTIVE" },
    { id: "new", status: "PENDING" },
  ];

  it("never offers a deactivated technician for a new booking", () => {
    expect(bookableTechnicians(technicians).map((account) => account.id)).toEqual(["jun", "new"]);
  });

  // Editing a visit a since-deactivated technician is on must not drop them.
  it("keeps a deactivated technician who is already on the crew", () => {
    expect(bookableTechnicians(technicians, ["ben"]).map((account) => account.id)).toEqual(["jun", "ben", "new"]);
  });
});
