import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppointmentCard from "../AppointmentCard";
import { CalendarProvider } from "../CalendarContext";

const client = { id: "c1", name: "Clizfel Testaclizfel", address: "12 Mabini St" };
const technician = { id: "t1", name: "Karl Hameed" };

const appointment = {
  id: "a1",
  clientId: "c1",
  technicianId: "t1",
  scheduledAt: "2026-09-22T09:00:00",
  durationMinutes: 60,
  status: "Confirmed",
  pestConcern: "Termites",
};

function renderCard({ value = {}, ...props } = {}) {
  const calendar = {
    clients: [client],
    accounts: [technician],
    selectedId: null,
    draggedId: null,
    canReschedule: true,
    onSelect: jest.fn(),
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
    ...value,
  };

  const result = render(
    <CalendarProvider value={calendar}>
      <AppointmentCard appointment={appointment} {...props} />
    </CalendarProvider>
  );

  return { ...result, calendar };
}

describe("AppointmentCard", () => {
  it("renders nothing when the client is missing", () => {
    const { container } = render(
      <CalendarProvider
        value={{
          clients: [],
          accounts: [],
          selectedId: null,
          draggedId: null,
          canReschedule: true,
          onSelect: jest.fn(),
          onDragStart: jest.fn(),
          onDragEnd: jest.fn(),
        }}
      >
        <AppointmentCard appointment={appointment} />
      </CalendarProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  // A 95px-wide column will never fit every client name, so the full detail
  // has to be reachable without opening the panel.
  it("carries the full detail in its title, whatever the height", () => {
    renderCard({ height: 30 });

    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      expect.stringContaining("Clizfel Testaclizfel")
    );
    expect(screen.getByRole("button").title).toContain("Karl Hameed");
    expect(screen.getByRole("button").title).toContain("Termites");
    expect(screen.getByRole("button").title).toContain("1 hour");
  });

  describe("content tiers", () => {
    // Technicians are initials now, never a colour; the full name is the
    // avatar's accessible label.
    it("shows the crew's initials and the pest concern only when there is room", () => {
      renderCard({ height: 90 });

      expect(screen.getByText("KH")).toBeInTheDocument();
      expect(screen.getByLabelText("Karl Hameed")).toBeInTheDocument();
      expect(screen.getByText(/Termites/)).toBeInTheDocument();
    });

    it("drops the technician line at medium height", () => {
      renderCard({ height: 60 });

      expect(screen.queryByText("KH")).not.toBeInTheDocument();
      expect(screen.getByText(/9:00/)).toBeInTheDocument();
    });

    it("keeps the name and start time even on the shortest card", () => {
      renderCard({ height: 30 });

      expect(screen.getByText("Clizfel Testaclizfel")).toBeInTheDocument();
      expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    });

    // The fix for "Clizfel Tes..." — a tall card gives the name two lines
    // instead of one ellipsised one. jsdom does not surface the prefixed
    // property through toHaveStyle, so read it off the style object.
    it("clamps a long name to two lines rather than ellipsising it away", () => {
      renderCard({ height: 90 });

      const name = screen.getByText("Clizfel Testaclizfel");
      expect(name.style.WebkitLineClamp || name.style.webkitLineClamp).toBe("2");
      expect(name).toHaveStyle({ overflow: "hidden" });
    });
  });

  describe("status cues", () => {
    it.each([
      ["Cancelled", true],
      ["Completed", false],
      ["Confirmed", false],
    ])("renders %s with the right strike treatment", (status, struck) => {
      render(
        <CalendarProvider
          value={{
            clients: [client],
            accounts: [technician],
            selectedId: null,
            draggedId: null,
            canReschedule: true,
            onSelect: jest.fn(),
            onDragStart: jest.fn(),
            onDragEnd: jest.fn(),
          }}
        >
          <AppointmentCard appointment={{ ...appointment, status }} height={60} />
        </CalendarProvider>
      );

      expect(screen.getByText("Clizfel Testaclizfel")).toHaveStyle({
        textDecoration: struck ? "line-through" : "none",
      });
    });

    it("names the status in the title so it is never colour-only", () => {
      renderCard({ height: 60 });

      expect(screen.getByRole("button").title).toContain("Confirmed");
    });
  });

  describe("interaction", () => {
    it("reports a click with the appointment", async () => {
      const { calendar } = renderCard({ height: 60 });

      await userEvent.click(screen.getByRole("button"));

      expect(calendar.onSelect).toHaveBeenCalledWith(appointment);
    });

    it("is draggable when the user may reschedule", () => {
      renderCard({ height: 60 });

      expect(screen.getByRole("button")).toHaveAttribute("draggable", "true");
    });

    // Technicians never drag: moving a visit is an office decision.
    it("is not draggable for a technician", () => {
      renderCard({ height: 60, value: { canReschedule: false } });

      expect(screen.getByRole("button")).toHaveAttribute("draggable", "false");
    });

    it("does not start a drag when the user may not reschedule", () => {
      const { calendar } = renderCard({ height: 60, value: { canReschedule: false } });

      screen.getByRole("button").dispatchEvent(new MouseEvent("dragstart", { bubbles: true }));

      expect(calendar.onDragStart).not.toHaveBeenCalled();
    });

    it("fades the card being dragged", () => {
      renderCard({ height: 60, value: { draggedId: "a1" } });

      expect(screen.getByRole("button")).toHaveStyle({ opacity: "0.45" });
    });

    it("marks the selected card for assistive technology", () => {
      renderCard({ height: 60, value: { selectedId: "a1" } });

      expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true");
    });
  });

  it("refuses to render outside a CalendarProvider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<AppointmentCard appointment={appointment} />)).toThrow(
      /CalendarProvider/
    );

    spy.mockRestore();
  });

  describe("status edge", () => {
    it.each([
      ["Confirmed", "solid"],
      ["Pending", "dashed"],
      ["Completed", "solid"],
    ])("draws %s with its own left edge and a %s border", (status, borderStyle) => {
      render(
        <CalendarProvider
          value={{
            clients: [client],
            accounts: [technician],
            selectedId: null,
            draggedId: null,
            canReschedule: true,
            onSelect: jest.fn(),
            onDragStart: jest.fn(),
            onDragEnd: jest.fn(),
          }}
        >
          <AppointmentCard appointment={{ ...appointment, status }} height={60} />
        </CalendarProvider>
      );

      const card = screen.getByRole("button");
      expect(card).toHaveStyle({ borderLeftWidth: "3px", borderStyle });
      expect(card.style.borderLeftColor).not.toBe("");
    });

    // A cancelled or finished visit has nowhere to be moved to.
    it("can drag a live visit but not a cancelled one", () => {
      const { unmount } = renderCard({ height: 60 });
      expect(screen.getByRole("button")).toHaveAttribute("draggable", "true");
      unmount();

      render(
        <CalendarProvider
          value={{
            clients: [client],
            accounts: [technician],
            selectedId: null,
            draggedId: null,
            canReschedule: true,
            onSelect: jest.fn(),
            onDragStart: jest.fn(),
            onDragEnd: jest.fn(),
          }}
        >
          <AppointmentCard appointment={{ ...appointment, status: "Cancelled" }} height={60} />
        </CalendarProvider>
      );
      expect(screen.getByRole("button")).toHaveAttribute("draggable", "false");
    });
  });
});
