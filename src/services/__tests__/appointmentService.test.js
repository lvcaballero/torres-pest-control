import { fetchAppointments, startVisit } from "../appointmentService";
import { supabase } from "../supabaseClient";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

// A chainable stand-in for the PostgREST query builder that resolves to `result`.
function query(result) {
  const chain = {};
  ["select", "order", "eq", "not"].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.then = (resolve) => resolve(result);
  return chain;
}

describe("fetchAppointments", () => {
  it("still loads the schedule before migration 048 adds started_at", async () => {
    const row = { id: "a1", client_id: "c1", scheduled_at: "2026-09-25T09:00:00Z", status: "Confirmed", technician_id: null };
    const selects = [];
    supabase.from.mockImplementation((table) => {
      if (table === "appointments") {
        const attempt = selects.length;
        const chain = query(
          attempt === 0
            ? { data: null, error: { message: 'column appointments.started_at does not exist', code: "42703" } }
            : { data: [row], error: null }
        );
        chain.select = jest.fn((columns) => {
          selects.push(columns);
          return chain;
        });
        return chain;
      }
      return query({ data: [], error: null });
    });

    const result = await fetchAppointments();

    expect(result.error).toBeNull();
    expect(result.appointments.map((entry) => entry.id)).toEqual(["a1"]);
    expect(selects[0]).toMatch(/started_at/);
    expect(selects[1]).not.toMatch(/started_at/);
  });
});

describe("startVisit", () => {
  it("returns the new status and start time", async () => {
    supabase.rpc.mockResolvedValue({ data: { status: "In progress", started_at: "2026-09-25T02:04:00Z" }, error: null });

    expect(await startVisit("a1")).toEqual({ status: "In progress", startedAt: "2026-09-25T02:04:00Z" });
    expect(supabase.rpc).toHaveBeenCalledWith("start_visit", { p_appointment_id: "a1" });
  });

  it("passes the server's refusal through", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "A visit can only be started on its scheduled day." } });

    expect((await startVisit("a1")).error).toMatch(/scheduled day/);
  });
});
