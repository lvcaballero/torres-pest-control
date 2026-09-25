import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VisitPage from "../VisitPage";

const mockNavigate = jest.fn();
const mockSubmitReport = jest.fn();
const mockStockOutMany = jest.fn();
const mockAddStockUsed = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
const mockState = { appointment: null, role: "TECHNICIAN" };

jest.mock("react-router-dom", () => ({ ...jest.requireActual("react-router-dom"), useNavigate: () => mockNavigate }));
jest.mock("../../hooks/useAuth", () => ({ __esModule: true, default: () => ({ currentUser: { id: "jun", role: mockState.role } }) }));
jest.mock("../../hooks/useClients", () => ({ __esModule: true, default: () => ({ clients: [{ id: "c1", name: "Manila Port Terminal 3" }] }) }));
jest.mock("../../hooks/useNow", () => ({ __esModule: true, default: () => new Date() }));
jest.mock("../../hooks/useInventory", () => ({
  __esModule: true,
  default: () => ({
    inventory: [
      { id: "blox", name: "Contrac Blox", unit: "kg", quantity: 12, status: "ACTIVE" },
      { id: "station", name: "Bait Station", unit: "pc", quantity: 140, status: "ACTIVE" },
    ],
    stockOutMany: mockStockOutMany,
  }),
}));
jest.mock("../../hooks/useServices", () => ({
  __esModule: true,
  default: () => ({
    serviceById: (id) => (id === "s1" ? { id: "s1", materials: [{ itemId: "blox", defaultAmount: 0.5 }, { itemId: "station", defaultAmount: 6 }] } : null),
    serviceByName: () => null,
  }),
}));
jest.mock("../../hooks/useTreatmentMethods", () => ({
  __esModule: true,
  default: () => ({ methods: [{ value: "BAIT_STATIONS", label: "Bait stations" }, { value: "GEL_BAIT", label: "Gel bait" }] }),
}));
jest.mock("../../context/SchedulingContext", () => ({
  useScheduling: () => ({
    appointments: mockState.appointment ? [mockState.appointment] : [],
    loading: false,
    startVisit: jest.fn(),
    submitReport: mockSubmitReport,
    uploadSignature: jest.fn(),
    addAttachment: jest.fn(),
    addStockUsed: mockAddStockUsed,
  }),
}));
jest.mock("../../context/ToastContext", () => ({ useToast: () => ({ showError: mockShowError, showSuccess: mockShowSuccess }) }));

const visit = {
  id: "a1",
  clientId: "c1",
  scheduledAt: new Date().toISOString(),
  durationMinutes: 60,
  status: "In progress",
  startedAt: new Date(Date.now() - 37 * 60000).toISOString(),
  technicianId: "jun",
  technicianIds: ["jun"],
  serviceId: "s1",
  reportSubmitted: false,
  attachments: [],
  stockUsed: [],
};

function renderVisit(appointment = visit, entry = "/visit/a1") {
  mockState.appointment = appointment;
  [mockNavigate, mockSubmitReport, mockStockOutMany, mockAddStockUsed, mockShowError, mockShowSuccess].forEach((fn) => fn.mockReset());
  localStorage.clear();
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/visit/:id" element={<VisitPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VisitPage", () => {
  it("shows the client and how long the visit has been going", () => {
    renderVisit();
    expect(screen.getByRole("heading", { name: "Manila Port Terminal 3" })).toBeInTheDocument();
    expect(screen.getByText(/Visit started .* · 37 min/)).toBeInTheDocument();
  });

  it("walks the four steps and won't leave Findings empty", async () => {
    renderVisit();
    expect(screen.getByRole("button", { name: "Findings", current: "step" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Next: Treatment/ }));
    expect(mockShowError).toHaveBeenCalledWith("Write what you found before moving on.");

    await userEvent.type(screen.getByLabelText("Findings"), "Burrows along the seawall fence line");
    await userEvent.click(screen.getByRole("button", { name: /Next: Treatment/ }));
    expect(screen.getByRole("group", { name: "Methods used" })).toBeInTheDocument();
  });

  it("prefills materials from the service and steps them by the unit", async () => {
    renderVisit(visit, "/visit/a1?step=Treatment");
    expect(screen.getByText("0.5 kg")).toBeInTheDocument();
    expect(screen.getByText("6 pc")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "More Contrac Blox" }));
    await userEvent.click(screen.getByRole("button", { name: "Less Bait Station" }));
    expect(screen.getByText("0.6 kg")).toBeInTheDocument();
    expect(screen.getByText("5 pc")).toBeInTheDocument();
  });

  it("keeps what was typed on the phone", async () => {
    renderVisit();
    await userEvent.type(screen.getByLabelText("Findings"), "Gnaw marks");
    expect(screen.getByText("Saved on this phone")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("torres_visit_draft_a1")).findings).toBe("Gnaw marks");
  });

  it("sends the report, then records the materials, then goes back to the day", async () => {
    renderVisit(visit, "/visit/a1?step=Treatment");
    mockSubmitReport.mockResolvedValue({});
    mockStockOutMany.mockResolvedValue(true);

    await userEvent.click(screen.getByRole("button", { name: /^Findings/ }));
    await userEvent.type(screen.getByLabelText("Findings"), "Droppings by the loading bay");
    await userEvent.click(screen.getByRole("button", { name: /^Treatment/ }));
    await userEvent.click(screen.getByRole("button", { name: "Bait stations" }));
    await userEvent.click(screen.getByRole("button", { name: /^Sign/ }));
    await userEvent.click(screen.getByRole("button", { name: /Send report/ }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
    expect(mockSubmitReport).toHaveBeenCalledWith("a1", expect.objectContaining({ findings: "Droppings by the loading bay", treatmentMethods: ["BAIT_STATIONS"] }));
    expect(mockStockOutMany).toHaveBeenCalledWith("a1", [{ itemId: "blox", amount: 0.5, batchNumber: "" }, { itemId: "station", amount: 6, batchNumber: "" }], expect.any(String));
    expect(mockShowSuccess).toHaveBeenCalledWith("Report sent. The visit stays open until the customer signs.");
    expect(localStorage.getItem("torres_visit_draft_a1")).toBeNull();
  });

  it("keeps the report when recording materials fails, and says so", async () => {
    renderVisit(visit, "/visit/a1?step=Findings");
    mockSubmitReport.mockResolvedValue({});
    mockStockOutMany.mockResolvedValue("Requested quantity for Contrac Blox exceeds available stock.");

    await userEvent.type(screen.getByLabelText("Findings"), "Droppings");
    await userEvent.click(screen.getByRole("button", { name: /^Treatment/ }));
    await userEvent.type(screen.getByLabelText("Treatment notes"), "Baited the perimeter");
    await userEvent.click(screen.getByRole("button", { name: /^Sign/ }));
    await userEvent.click(screen.getByRole("button", { name: /Send report/ }));

    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/^Report sent, but the materials weren't recorded/)));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("refuses a visit that isn't the technician's", () => {
    renderVisit({ ...visit, technicianId: "ramon", technicianIds: ["ramon"] });
    expect(screen.getByText(/not assigned to you/)).toBeInTheDocument();
  });
});
