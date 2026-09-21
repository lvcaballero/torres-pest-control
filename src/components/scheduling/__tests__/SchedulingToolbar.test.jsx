import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SchedulingToolbar, { MODES, isCalendarMode } from "../SchedulingToolbar";
import { TECHNICIAN_PALETTE, UNASSIGNED_COLOR } from "../appointmentTheme";

const technicians = [
  { id: "t1", name: "Karl Hameed" },
  { id: "t2", name: "Bruce Banner" },
];

const base = {
  mode: MODES.WEEK,
  onModeChange: jest.fn(),
  rangeLabel: "Sep 21 - Sep 27, 2026",
  onNavigate: jest.fn(),
  onToday: jest.fn(),
  isOnToday: false,
  technicians,
  technicianFilter: "ALL",
  onTechnicianFilterChange: jest.fn(),
  colorFor: () => TECHNICIAN_PALETTE[0],
  unassignedColor: UNASSIGNED_COLOR,
  countFor: () => 3,
  isTechnician: false,
  canCreate: true,
  onCreate: jest.fn(),
};

const renderToolbar = (props = {}) => {
  Object.values(base).forEach((v) => typeof v === "function" && v.mockClear?.());
  render(<SchedulingToolbar {...base} {...props} />);
};

describe("isCalendarMode", () => {
  it("treats week and month as calendar modes", () => {
    expect(isCalendarMode(MODES.WEEK)).toBe(true);
    expect(isCalendarMode(MODES.MONTH)).toBe(true);
    expect(isCalendarMode(MODES.LIST)).toBe(false);
    expect(isCalendarMode(MODES.TECHNICIANS)).toBe(false);
  });
});

describe("SchedulingToolbar", () => {
  // The merge that removed a whole control: `view` (week/month) and
  // `scheduleTab` (calendar/list/technicians) were two segmented controls
  // for what is really one choice.
  it("offers all four views in a single control", () => {
    renderToolbar();

    const group = screen.getByRole("radiogroup", { name: "Scheduling view" });
    ["Week", "Month", "List", "Technicians"].forEach((label) => {
      expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeInTheDocument();
    });
    expect(group).toBeInTheDocument();
  });

  it("marks the current view", () => {
    renderToolbar({ mode: MODES.MONTH });

    expect(screen.getByRole("radio", { name: /Month/ })).toBeChecked();
  });

  it("reports a view change", async () => {
    renderToolbar();

    await userEvent.click(screen.getByRole("radio", { name: /List/ }));

    expect(base.onModeChange).toHaveBeenCalledWith(MODES.LIST);
  });

  // Technicians never see the cross-technician views or the filter.
  it("hides the technicians view and the filter from a technician", () => {
    renderToolbar({ isTechnician: true });

    expect(screen.queryByRole("radio", { name: /Technicians/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /All technicians/ })).not.toBeInTheDocument();
  });

  describe("period navigation", () => {
    it("shows the range and steps either way", async () => {
      renderToolbar();

      expect(screen.getByText("Sep 21 - Sep 27, 2026")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Previous period" }));
      expect(base.onNavigate).toHaveBeenCalledWith(-1);

      await userEvent.click(screen.getByRole("button", { name: "Next period" }));
      expect(base.onNavigate).toHaveBeenCalledWith(1);
    });

    // New: there was previously no way back to the current week except
    // clicking a chevron repeatedly.
    it("jumps back to today", async () => {
      renderToolbar();

      await userEvent.click(screen.getByRole("button", { name: "Today" }));

      expect(base.onToday).toHaveBeenCalledTimes(1);
    });

    it("disables Today when already there, so it is not a no-op", () => {
      renderToolbar({ isOnToday: true });

      expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
    });

    // List mode has its own date-from/date-to filters; a period stepper
    // would be a second, contradictory way to choose a range.
    it("hides the period navigation in list mode", () => {
      renderToolbar({ mode: MODES.LIST });

      expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
      expect(screen.queryByText("Sep 21 - Sep 27, 2026")).not.toBeInTheDocument();
    });
  });

  describe("technician filter", () => {
    it("opens a list with a swatch and a count per technician", async () => {
      renderToolbar();

      await userEvent.click(screen.getByRole("button", { name: /All technicians/ }));

      expect(screen.getByRole("listbox", { name: "Filter by technician" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Karl Hameed/ })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Unassigned/ })).toBeInTheDocument();
    });

    it("reports the chosen technician and closes", async () => {
      renderToolbar();

      await userEvent.click(screen.getByRole("button", { name: /All technicians/ }));
      await userEvent.click(screen.getByRole("option", { name: /Bruce Banner/ }));

      expect(base.onTechnicianFilterChange).toHaveBeenCalledWith("t2");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("selects unassigned-only with the empty value", async () => {
      renderToolbar();

      await userEvent.click(screen.getByRole("button", { name: /All technicians/ }));
      await userEvent.click(screen.getByRole("option", { name: /Unassigned/ }));

      expect(base.onTechnicianFilterChange).toHaveBeenCalledWith("");
    });

    it("names the active filter on the trigger, so a filtered week is obvious", () => {
      renderToolbar({ technicianFilter: "t1" });

      expect(screen.getByRole("button", { name: /Karl Hameed/ })).toBeInTheDocument();
    });

    it("closes on Escape", async () => {
      renderToolbar();

      await userEvent.click(screen.getByRole("button", { name: /All technicians/ }));
      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("create", () => {
    it("offers the action next to the calendar it acts on", async () => {
      renderToolbar();

      await userEvent.click(screen.getByRole("button", { name: /New appointment/ }));

      expect(base.onCreate).toHaveBeenCalledTimes(1);
    });

    it("hides it from someone who may not create", () => {
      renderToolbar({ canCreate: false });

      expect(screen.queryByRole("button", { name: /New appointment/ })).not.toBeInTheDocument();
    });
  });
});
