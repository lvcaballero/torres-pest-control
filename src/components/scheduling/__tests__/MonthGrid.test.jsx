import { fireEvent, render, screen } from "@testing-library/react";
import MonthGrid from "../MonthGrid";
import { CalendarProvider } from "../CalendarContext";
import { localDateKey } from "../../../utils/calendarDates";

const ANCHOR = new Date(2026, 8, 15); // September 2026
const monthCells = Array.from({ length: 14 }, (_, i) => new Date(2026, 8, 1 + i));
const TARGET = monthCells[3];

const client = { id: "c1", name: "Rhey Garcia" };

const appointment = {
  id: "a1",
  clientId: "c1",
  technicianId: "t1",
  scheduledAt: `${localDateKey(monthCells[0])}T15:00:00`,
  durationMinutes: 60,
  status: "Confirmed",
};

function renderMonth({ onDropAt = jest.fn(), appointments = [appointment] } = {}) {
  render(
    <CalendarProvider
      value={{
        clients: [client],
        accounts: [{ id: "t1", name: "Karl Hameed" }],
        selectedId: null,
        draggedId: null,
        canReschedule: true,
        onSelect: jest.fn(),
        onDragStart: jest.fn(),
        onDragEnd: jest.fn(),
      }}
    >
      <MonthGrid
        monthCells={monthCells}
        anchorDate={ANCHOR}
        appointmentsFor={(key) =>
          appointments.filter((a) => localDateKey(new Date(a.scheduledAt)) === key)
        }
        onDropAt={onDropAt}
      />
    </CalendarProvider>
  );

  return { onDropAt };
}

describe("MonthGrid", () => {
  it("renders a cell per day with its date number", () => {
    renderMonth();

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("places an appointment in its own day's cell", () => {
    renderMonth();

    expect(screen.getByText("Rhey Garcia")).toBeInTheDocument();
  });

  // The bug this layout replaced: the drop handler passed no time and let
  // moveAppointment's "09:00" default decide, so dropping a 3 PM visit
  // anywhere in a month cell silently rebooked it to 9 AM.
  it("reports only the target date, leaving the time to the caller", () => {
    const { onDropAt } = renderMonth();

    const cell = screen.getByText(String(TARGET.getDate())).closest("div");
    fireEvent.drop(cell);

    expect(onDropAt).toHaveBeenCalledTimes(1);
    expect(onDropAt).toHaveBeenCalledWith(localDateKey(TARGET));
    // Crucially, no second argument — a month cell has no time to offer.
    expect(onDropAt.mock.calls[0]).toHaveLength(1);
  });

  it("allows the drop by cancelling dragover", () => {
    renderMonth();

    const cell = screen.getByText(String(TARGET.getDate())).closest("div");
    const event = new MouseEvent("dragover", { bubbles: true, cancelable: true });
    fireEvent(cell, event);

    expect(event.defaultPrevented).toBe(true);
  });
});
