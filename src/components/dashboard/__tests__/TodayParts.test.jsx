import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AttentionList, DispatchBoard, KpiCard, RecentList, WeekBarsCard } from "../TodayParts";
import { daySummary } from "../OfficeDashboard";
import { dispatchLanes } from "../../../utils/dispatch";

jest.mock("../../../hooks/useAuth", () => ({ __esModule: true, default: () => ({}) }));
jest.mock("../../../hooks/useClients", () => ({ __esModule: true, default: () => ({ clients: [] }) }));
jest.mock("../../../hooks/useUsers", () => ({ __esModule: true, default: () => ({ users: [] }) }));
jest.mock("../../../context/SchedulingContext", () => ({ useScheduling: () => ({ appointments: [] }) }));
jest.mock("../../../context/InventoryContext", () => ({ useInventoryContext: () => ({ inventory: [], movements: [] }) }));
jest.mock("../../../context/ToastContext", () => ({ useToast: () => ({ showError: jest.fn(), showSuccess: jest.fn() }) }));

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const now = new Date(2026, 8, 25, 9, 12);
const at = (hour, minute = 0) => new Date(2026, 8, 25, hour, minute).toISOString();
const jun = { id: "jun", name: "Jun Dela Cruz" };
const ramon = { id: "ramon", name: "Ramon Reyes" };
const appointments = [
  { id: "a1", clientId: "c1", scheduledAt: at(8), durationMinutes: 60, status: "Completed", technicianId: "jun", technicianIds: ["jun"], reportSubmitted: true },
  { id: "a2", clientId: "c2", scheduledAt: at(9), durationMinutes: 120, status: "Confirmed", technicianId: "ramon", technicianIds: ["ramon"] },
  { id: "a3", clientId: "c3", scheduledAt: at(13), durationMinutes: 60, status: "Pending", technicianId: "", technicianIds: [] },
];
const names = { c1: "Jollibee Katipunan", c2: "Santos Residence", c3: "Cruz Bakery" };

describe("daySummary", () => {
  it("reads as one sentence, pluralised", () => {
    expect(daySummary({ visitsToday: 7, technicianCount: 3, attentionCount: 4 })).toBe("7 visits today across 3 technicians. 4 things need you.");
    expect(daySummary({ visitsToday: 1, technicianCount: 1, attentionCount: 1 })).toBe("1 visit today across 1 technician. 1 thing needs you.");
    expect(daySummary({ visitsToday: 0, technicianCount: 0, attentionCount: 0 })).toBe("No visits today. Nothing needs you right now.");
  });
});

describe("KpiCard", () => {
  it("is a link to the list behind the number", () => {
    wrap(<KpiCard label="Unassigned" value={2} footer="Needs a technician" to="/scheduling" />);

    expect(screen.getByRole("link", { name: /Unassigned\s*2/ })).toHaveAttribute("href", "/scheduling");
  });
});

describe("DispatchBoard", () => {
  const renderBoard = (onAssign = null) =>
    wrap(
      <DispatchBoard
        lanes={dispatchLanes(appointments, [jun, ramon], now)}
        day={now}
        now={now}
        clientName={(id) => names[id]}
        onAssign={onAssign}
        dayChoice="today"
        onDayChange={() => {}}
      />
    );

  it("draws a lane per technician plus Unassigned, with each visit in its lane", () => {
    renderBoard();

    expect(within(screen.getByRole("group", { name: /Jun Dela Cruz: 1 visit/ })).getByText("Jollibee Katipunan")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: /Ramon Reyes/ })).getByText("Santos Residence")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: /Unassigned/ })).getByText("Cruz Bakery")).toBeInTheDocument();
  });

  it("says a finished visit is done and a running one is on site", () => {
    renderBoard();

    expect(screen.getByText(/· done/)).toBeInTheDocument();
    expect(screen.getByText(/· on site/)).toBeInTheDocument();
  });

  it("shows where now is", () => {
    renderBoard();

    expect(screen.getByText(/Red line = now/)).toBeInTheDocument();
  });

  it("assigns an unassigned visit dropped on a technician's lane", () => {
    const onAssign = jest.fn();
    renderBoard(onAssign);

    const card = screen.getByText("Cruz Bakery").closest("a");
    expect(card).toHaveAttribute("draggable", "true");
    fireEvent.dragStart(card);
    const lane = screen.getByRole("group", { name: /Jun Dela Cruz/ });
    fireEvent.dragOver(lane);
    fireEvent.drop(lane);

    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "a3" }), jun);
  });

  it("offers no dragging to someone who cannot assign", () => {
    renderBoard(null);

    expect(screen.getByText("Cruz Bakery").closest("a")).toHaveAttribute("draggable", "false");
  });
});

describe("AttentionList", () => {
  it("gives every item its one action", () => {
    wrap(
      <AttentionList
        items={[
          { key: "u", kind: "unassigned", tone: "warning", title: "2 visits have no technician", detail: "Cruz Bakery 9:00 today", action: { label: "Assign", to: "/scheduling?appointment=a3" } },
          { key: "r", kind: "reorder", tone: "neutral", title: "3 items below reorder level", detail: "Glue boards", action: { label: "Reorder", to: "/inventory" } },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Assign" })).toHaveAttribute("href", "/scheduling?appointment=a3");
    expect(screen.getByRole("link", { name: "Reorder" })).toHaveAttribute("href", "/inventory");
  });

  it("says so when there is nothing to do", () => {
    wrap(<AttentionList items={[]} />);

    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
  });
});

describe("WeekBarsCard", () => {
  it("labels every bar with its value", () => {
    const bars = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => ({
      key: label,
      label,
      value: index,
      isToday: index === 4,
      isFuture: index > 4,
    }));
    wrap(<WeekBarsCard bars={bars} rangeLabel="Sep 21 – 27" />);

    expect(screen.getByRole("listitem", { name: "Fri: 4 visits (today)" })).toBeInTheDocument();
    expect(screen.getByText(/21 total/)).toBeInTheDocument();
  });
});

describe("RecentList", () => {
  it("shows the report state as a word", () => {
    wrap(<RecentList rows={[{ id: "a1", when: "9:40 AM", title: "Tan Family Home", detail: "Rodents · Ramon Reyes", state: "Report due", to: "/scheduling" }]} />);

    expect(screen.getByText("Report due")).toBeInTheDocument();
  });
});
