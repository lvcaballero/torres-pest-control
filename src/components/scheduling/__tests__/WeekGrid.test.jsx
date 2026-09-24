import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WeekGrid from "../WeekGrid";
import { CalendarProvider } from "../CalendarContext";
import { layoutDayAppointments } from "../../../utils/scheduling";
import { addDays, localDateKey, startOfWeek } from "../../../utils/calendarDates";

const MONDAY = new Date(2026, 8, 21);
const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(MONDAY), i));
const MONDAY_KEY = localDateKey(weekDays[0]);

const client = { id: "c1", name: "Rhey Garcia" };
const technician = { id: "t1", name: "Karl Hameed" };

const appt = (id, time, durationMinutes = 60) => ({
  id,
  clientId: "c1",
  technicianId: "t1",
  scheduledAt: `${MONDAY_KEY}T${time}:00`,
  durationMinutes,
  status: "Confirmed",
});

function buildLayout(appointments) {
  const map = new Map();
  weekDays.forEach((date) => map.set(localDateKey(date), { placed: [], overflow: [], outside: [] }));
  const byDay = new Map();
  appointments.forEach((a) => {
    const key = localDateKey(new Date(a.scheduledAt));
    byDay.set(key, [...(byDay.get(key) || []), a]);
  });
  byDay.forEach((list, key) => {
    map.set(key, { ...layoutDayAppointments(list, { maxColumns: 3 }), outside: [] });
  });
  return map;
}

function renderGrid({ appointments = [], window = { startHour: 9, endHour: 15 }, rowHeight = 60, ...props } = {}) {
  const handlers = {
    onEmptyClick: jest.fn(),
    onDropAt: jest.fn(),
    onShowOverflow: jest.fn(),
    onShowAllHours: jest.fn(),
    ...props,
  };

  const calendar = {
    clients: [client],
    accounts: [technician],
    selectedId: null,
    draggedId: null,
    canReschedule: true,
    onSelect: jest.fn(),
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
  };

  render(
    <CalendarProvider value={calendar}>
      <WeekGrid
        weekDays={weekDays}
        weekLayout={buildLayout(appointments)}
        window={window}
        rowHeight={rowHeight}
        dayStartHour={7}
        dayEndHour={19}
        {...handlers}
      />
    </CalendarProvider>
  );

  return { ...handlers, calendar };
}

/**
 * A day's positioned layer, with its bounding box pinned to the origin so the
 * pointer maths below is deterministic — jsdom reports every rect as zeroes.
 */
function dayColumnFor(dayIndex) {
  const column = document.querySelector(`[data-day="${localDateKey(weekDays[dayIndex])}"]`);
  jest.spyOn(column, "getBoundingClientRect").mockReturnValue({ top: 0, left: 0 });
  return column;
}

/**
 * jsdom's DragEvent does not carry pointer coordinates, and Testing Library's
 * fireEvent.drop inherits that — clientY arrives as undefined and the time
 * maths yields NaN. A mouse-typed "drop" event does carry them, and React
 * listens for the event name rather than the constructor.
 */
function dropAt(element, clientY) {
  fireEvent(element, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY }));
}

describe("WeekGrid", () => {
  it("renders one label per hour in the window, and no more", () => {
    renderGrid({ window: { startHour: 9, endHour: 13 } });

    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("12:00 PM")).toBeInTheDocument();
    // The old grid always drew 7 AM through 8 PM regardless of content.
    expect(screen.queryByText("7:00 AM")).not.toBeInTheDocument();
    expect(screen.queryByText("1:00 PM")).not.toBeInTheDocument();
  });

  it("renders all seven day headers", () => {
    renderGrid();

    weekDays.forEach((date) => {
      expect(screen.getAllByText(String(date.getDate())).length).toBeGreaterThan(0);
    });
  });

  it("draws the week's appointments", () => {
    renderGrid({ appointments: [appt("a1", "10:00")] });

    expect(screen.getByText("Rhey Garcia")).toBeInTheDocument();
  });

  describe("click to create", () => {
    // The grid's own click math: offset -> minutes -> clock time. Getting
    // this wrong means the create form opens on a different time than the
    // slot the user clicked.
    it("reports the clock time of the slot that was clicked", async () => {
      const { onEmptyClick } = renderGrid({ window: { startHour: 9, endHour: 15 }, rowHeight: 60 });

      const dayColumn = dayColumnFor(0);

      fireEvent.click(dayColumn, { clientY: 120 }); // two rows down from 9:00

      expect(onEmptyClick).toHaveBeenCalledWith(MONDAY_KEY, "11:00");
    });

    it("snaps to ten-minute increments", () => {
      const { onEmptyClick } = renderGrid({ window: { startHour: 9, endHour: 15 }, rowHeight: 60 });

      const dayColumn = dayColumnFor(0);

      fireEvent.click(dayColumn, { clientY: 34 }); // 9:34

      expect(onEmptyClick).toHaveBeenCalledWith(MONDAY_KEY, "09:30");
    });

    // The window can start before the working day so an early visit stays
    // visible, but creating one there would be refused by the server.
    it("clamps a click above the working day up to opening time", () => {
      const { onEmptyClick } = renderGrid({ window: { startHour: 5, endHour: 12 }, rowHeight: 60 });

      const dayColumn = dayColumnFor(0);

      fireEvent.click(dayColumn, { clientY: 0 }); // 5:00, before the 7:00 open

      expect(onEmptyClick).toHaveBeenCalledWith(MONDAY_KEY, "07:00");
    });

    it("ignores a click that landed on a card", async () => {
      const { onEmptyClick, calendar } = renderGrid({ appointments: [appt("a1", "10:00")] });

      await userEvent.click(screen.getByText("Rhey Garcia"));

      expect(onEmptyClick).not.toHaveBeenCalled();
      expect(calendar.onSelect).toHaveBeenCalled();
    });
  });

  describe("drop", () => {
    it("reports the day and the snapped time it was dropped on", () => {
      const { onDropAt } = renderGrid({ window: { startHour: 9, endHour: 15 }, rowHeight: 60 });

      const dayColumn = dayColumnFor(1);

      dropAt(dayColumn, 90); // 10:30 on Tuesday

      expect(onDropAt).toHaveBeenCalledWith(localDateKey(weekDays[1]), "10:30");
    });

    it("lands on the same time the click handler would report", () => {
      const { onDropAt, onEmptyClick } = renderGrid({ window: { startHour: 7, endHour: 14 }, rowHeight: 88 });

      const dayColumn = dayColumnFor(0);

      fireEvent.click(dayColumn, { clientY: 200 });
      dropAt(dayColumn, 200);

      expect(onDropAt.mock.calls[0]).toEqual(onEmptyClick.mock.calls[0]);
    });
  });

  describe("overflow", () => {
    it("shows a +N more tile once a cluster is too deep to read", () => {
      renderGrid({
        appointments: ["a", "b", "c", "d", "e"].map((id) => appt(id, "10:00")),
      });

      expect(screen.getByText("+3 more")).toBeInTheDocument();
    });

    it("hands the group back when the tile is clicked", async () => {
      const { onShowOverflow } = renderGrid({
        appointments: ["a", "b", "c", "d", "e"].map((id) => appt(id, "10:00")),
      });

      await userEvent.click(screen.getByText("+3 more"));

      expect(onShowOverflow).toHaveBeenCalledWith(
        expect.objectContaining({ dateKey: MONDAY_KEY, items: expect.any(Array) })
      );
    });
  });
});
