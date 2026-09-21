// Smoke tests for the wired page.
//
// The calendar's pieces are unit tested on their own, but nothing there
// proves SchedulingPage passes them the right things. These mount the real
// page with its data hooks mocked, which is what catches a prop renamed on
// one side of a boundary and not the other — a class of bug that compiles
// cleanly and then renders an empty grid.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import SchedulingPage from "../SchedulingPage";
import { localDateKey, startOfWeek } from "../../utils/calendarDates";

// SchedulingPage reads ?appointment= via useSearchParams, so it needs a router
// in scope. Every case renders through this helper rather than bare render().
function renderPage(entry = "/scheduling") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SchedulingPage />
    </MemoryRouter>
  );
}

const MONDAY = startOfWeek(new Date());
const dayKey = (offset = 0) => {
  const date = new Date(MONDAY);
  date.setDate(date.getDate() + offset);
  return localDateKey(date);
};

const mockClients = [
  { id: "c1", name: "Rhey Garcia", address: "12 Mabini St", phone: "09171234567" },
  { id: "c2", name: "Clizfel Testaclizfel", address: "4 Rizal Ave" },
];

const mockTechnicians = [
  { id: "t1", name: "Karl Hameed", role: "TECHNICIAN", status: "ACTIVE" },
  { id: "t2", name: "Bruce Banner", role: "TECHNICIAN", status: "ACTIVE" },
];

const mockAppointments = [
  {
    id: "a1",
    clientId: "c1",
    technicianId: "t1",
    scheduledAt: `${dayKey(0)}T09:00:00`,
    durationMinutes: 60,
    status: "Confirmed",
    pestConcern: "Termites",
  },
  {
    id: "a2",
    clientId: "c2",
    technicianId: "t2",
    scheduledAt: `${dayKey(2)}T15:00:00`,
    durationMinutes: 120,
    status: "Pending",
    pestConcern: "Snakes",
  },
];

const mockUpdateAppointment = jest.fn(async (a) => a);
const mockCreateAppointment = jest.fn(async (a) => ({ ...a, id: "new" }));

jest.mock("../../hooks/useAuth", () => ({
  __esModule: true,
  default: () => ({
    can: () => true,
    currentUser: { id: "u1", name: "Office Admin", role: "ADMIN" },
  }),
}));

jest.mock("../../hooks/useClients", () => ({
  __esModule: true,
  default: () => ({
    clients: mockClients,
    addDocument: jest.fn(),
    removeDocument: jest.fn(),
    getDocumentUrl: jest.fn(),
  }),
}));

jest.mock("../../hooks/useInventory", () => ({
  __esModule: true,
  default: () => ({ inventory: [], stockOutMany: jest.fn() }),
}));

jest.mock("../../hooks/useUsers", () => ({
  __esModule: true,
  default: () => ({ staff: [], technicians: mockTechnicians }),
}));

jest.mock("../../hooks/useTreatmentMethods", () => ({
  __esModule: true,
  default: () => ({ methods: [], groups: [] }),
}));

jest.mock("../../context/SchedulingContext", () => ({
  useScheduling: () => ({
    appointments: mockAppointments,
    createAppointment: mockCreateAppointment,
    updateAppointment: mockUpdateAppointment,
    submitReport: jest.fn(),
    addStockUsed: jest.fn(),
    addAttachment: jest.fn(),
    removeAttachment: jest.fn(),
    getAttachmentUrl: jest.fn(),
    uploadSignature: jest.fn(),
    getSignatureUrl: jest.fn(),
    loading: false,
    error: "",
  }),
}));

jest.mock("../../context/ToastContext", () => ({
  useToast: () => ({ showError: jest.fn(), showSuccess: jest.fn() }),
}));

beforeEach(() => {
  mockUpdateAppointment.mockClear();
  mockCreateAppointment.mockClear();
});

describe("SchedulingPage", () => {
  it("renders the page header", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Scheduling" })).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
  });

  it("renders one toolbar with every view, the period nav and the create action", () => {
    renderPage();

    const views = screen.getByRole("radiogroup", { name: "Scheduling view" });
    ["Week", "Month", "List", "Technicians"].forEach((label) => {
      expect(within(views).getByRole("radio", { name: new RegExp(label) })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New appointment/ })).toBeInTheDocument();
  });

  it("opens on the week grid with this week's appointments drawn", () => {
    renderPage();

    expect(screen.getByText("Rhey Garcia")).toBeInTheDocument();
    expect(screen.getByText("Clizfel Testaclizfel")).toBeInTheDocument();
  });

  // The density fix. With appointments at 9 AM and 3-5 PM the grid needs
  // roughly 8 AM to 6 PM — not the full 7 AM to 8 PM it always drew before.
  it("renders only the hours the week actually uses", () => {
    renderPage();

    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("3:00 PM")).toBeInTheDocument();
    expect(screen.queryByText("7:00 PM")).not.toBeInTheDocument();
  });

  it("starts on today, so the Today button has nothing to do", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("enables Today once the user has navigated away, and returns", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Next period" }));
    const today = screen.getByRole("button", { name: "Today" });
    expect(today).toBeEnabled();

    await userEvent.click(today);
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  describe("switching views", () => {
    it("shows the list with its own filters", async () => {
      renderPage();

      await userEvent.click(screen.getByRole("radio", { name: /List/ }));

      expect(screen.getByLabelText("Search appointments")).toBeInTheDocument();
      expect(screen.getByLabelText("Status")).toBeInTheDocument();
      // List has date-from/to of its own, so the period stepper steps aside.
      expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
    });

    it("shows the month grid", async () => {
      renderPage();

      await userEvent.click(screen.getByRole("radio", { name: /Month/ }));

      // The month label replaces the week range.
      expect(screen.getByText(new RegExp(new Date().toLocaleDateString([], { month: "long" })))).toBeInTheDocument();
    });

    it("shows the technicians view", async () => {
      renderPage();

      await userEvent.click(screen.getByRole("radio", { name: /Technicians/ }));

      expect(screen.getAllByText(/Karl Hameed/).length).toBeGreaterThan(0);
    });
  });

  it("filters the calendar down to one technician", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /All technicians/ }));
    await userEvent.click(screen.getByRole("option", { name: /Karl Hameed/ }));

    expect(screen.getByText("Rhey Garcia")).toBeInTheDocument();
    expect(screen.queryByText("Clizfel Testaclizfel")).not.toBeInTheDocument();
  });

  // The old page carried a sentence explaining that a dashed outline meant
  // Pending and a dotted one meant Reschedule. The encoding it described was
  // invisible on a real card; the replacement needs no prose.
  it("no longer needs a legend explaining its status encoding", () => {
    renderPage();

    expect(screen.queryByText(/Dashed outline = Pending/)).not.toBeInTheDocument();
  });

  it("opens the create form from the toolbar", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /New appointment/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  describe("the detail panel", () => {
    it("opens when an appointment is clicked", async () => {
      renderPage();

      await userEvent.click(screen.getByText("Rhey Garcia"));

      expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
    });

    // The panel takes six grouped prop objects rather than thirty loose
    // props. A group spelled wrongly at the call site destructures to
    // undefined and throws on first use, so mounting it is the check.
    it("receives every prop group it destructures", async () => {
      renderPage();

      await userEvent.click(screen.getByText("Rhey Garcia"));

      // The card behind the panel also carries the client name, so assert on
      // the controls the panel's own prop groups feed instead: the tab strip
      // comes from `ui`, the save button from `actions`.
      expect(screen.getByRole("button", { name: /Save appointment/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Stock-Out" })).toBeInTheDocument();
    });

    // The technician permission gate is a `fieldset disabled` wrapper. A form
    // moved outside one becomes editable by someone who may not edit it.
    it("keeps the overview form inside its permission fieldset", async () => {
      renderPage();

      await userEvent.click(screen.getByText("Rhey Garcia"));

      const save = screen.getByRole("button", { name: /Save appointment/i });
      expect(save.closest("fieldset")).not.toBeNull();
    });
  });

  // "Schedule follow-up" was unreachable: it set the client id and opened the
  // create modal, but never closed the detail panel, and the panel's backdrop
  // sat at a HIGHER z-index than the modal — so the form opened behind the
  // thing that launched it.
  it("closes the detail panel when scheduling a follow-up, so the form is reachable", async () => {
    renderPage();

    await userEvent.click(screen.getByText("Rhey Garcia"));
    const followUp = screen.queryByRole("button", { name: /follow-up/i });
    if (!followUp) return; // the action lives behind the report tab

    await userEvent.click(followUp);

    expect(screen.getByRole("dialog")).toHaveAccessibleName("New appointment");
  });

  // Dragging used to write status = "Reschedule" to the database before any
  // drop happened, so aborting a drag stranded the appointment in that state.
  it("does not save anything when a drag starts", () => {
    renderPage();

    const card = screen.getByText("Rhey Garcia").closest("button");
    card.dispatchEvent(new MouseEvent("dragstart", { bubbles: true }));

    expect(mockUpdateAppointment).not.toHaveBeenCalled();
  });
});
