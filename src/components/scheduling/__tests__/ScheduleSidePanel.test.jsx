import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScheduleSidePanel from "../ScheduleSidePanel";

const reschedule = [{ id: "a1", clientId: "c1", scheduledAt: "2026-09-24T16:00:00", status: "Reschedule" }];
const reservice = [
  {
    client: { id: "c2", name: "Cruz Bakery" },
    last: { id: "old", serviceId: "s1", serviceFrequency: "Quarterly", pestConcern: "Cockroaches" },
    dueAt: new Date(2026, 8, 20),
    frequency: "Quarterly",
  },
];
const load = [
  { technician: { id: "jun", name: "Jun Dela Cruz" }, hours: 14 },
  { technician: { id: "ramon", name: "Ramon Reyes" }, hours: 11 },
];

function renderPanel(props = {}) {
  const handlers = {
    onDragAppointment: jest.fn(),
    onDragReservice: jest.fn(),
    onDragEnd: jest.fn(),
    onOpenAppointment: jest.fn(),
    onBookReservice: jest.fn(),
  };
  render(
    <ScheduleSidePanel
      reschedule={reschedule}
      reservice={reservice}
      load={load}
      clientName={(id) => (id === "c1" ? "Ateneo Grade School" : "?")}
      canDrag
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe("ScheduleSidePanel", () => {
  it("lists visits waiting for a new slot and clients due for re-service", () => {
    renderPanel();

    const unscheduled = screen.getByRole("region", { name: "Unscheduled" });
    expect(within(unscheduled).getByText("Ateneo Grade School")).toBeInTheDocument();
    expect(within(unscheduled).getByText(/Reschedule requested/)).toBeInTheDocument();
    expect(within(unscheduled).getByText("Cruz Bakery")).toBeInTheDocument();
    expect(within(unscheduled).getByText(/Re-service · quarterly/)).toBeInTheDocument();
  });

  it("hands the page what is being dragged", () => {
    const handlers = renderPanel();

    fireEvent.dragStart(screen.getByText("Ateneo Grade School").closest("button"));
    expect(handlers.onDragAppointment).toHaveBeenCalledWith(reschedule[0]);

    fireEvent.dragStart(screen.getByText("Cruz Bakery").closest("button"));
    expect(handlers.onDragReservice).toHaveBeenCalledWith(reservice[0]);
  });

  it("books a re-service or opens a visit on click, for anyone who can't drag", async () => {
    const handlers = renderPanel({ canDrag: false });

    expect(screen.getByText("Cruz Bakery").closest("button")).toHaveAttribute("draggable", "false");
    await userEvent.click(screen.getByText("Cruz Bakery"));
    expect(handlers.onBookReservice).toHaveBeenCalledWith(reservice[0]);
    await userEvent.click(screen.getByText("Ateneo Grade School"));
    expect(handlers.onOpenAppointment).toHaveBeenCalledWith(reschedule[0]);
  });

  it("says so when nothing is waiting", () => {
    renderPanel({ reschedule: [], reservice: [] });

    expect(screen.getByText("Nothing waiting for a slot.")).toBeInTheDocument();
  });

  it("shows each technician's booked hours this week", () => {
    renderPanel();

    const panel = screen.getByRole("region", { name: "Technician load" });
    expect(within(panel).getByText("14 h / 40")).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: "Ramon Reyes: 11 of 40 hours booked" })).toBeInTheDocument();
  });

  it("carries the legend and says a drag keeps the status", () => {
    renderPanel();

    const legend = screen.getByRole("region", { name: "Legend" });
    expect(within(legend).getByText("Reschedule")).toBeInTheDocument();
    expect(within(legend).getByText(/keeps its status and shows Undo/)).toBeInTheDocument();
  });
});
