import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ClientsPage, { CLIENT_PAGE_SIZE } from "../ClientsPage";
import { filterClients } from "../../services/clientService";

jest.mock("../../services/supabaseClient", () => ({ supabase: {} }));

const mockClients = Array.from({ length: CLIENT_PAGE_SIZE + 5 }, (_, index) => ({
  id: `c${index}`,
  reference: `CL-2026-${String(index).padStart(4, "0")}`,
  name: `Client ${String(index).padStart(2, "0")}`,
  address: "Quezon City",
  classification: "RESIDENTIAL",
  pestConcern: "Rodents",
  status: "ACTIVE",
  documents: [],
}));
mockClients[0] = { ...mockClients[0], name: "Aaa Bakery" };
const mockSoon = new Date();
mockSoon.setDate(mockSoon.getDate() + 3);

jest.mock("../../hooks/useAuth", () => ({ __esModule: true, default: () => ({ can: () => true }) }));
jest.mock("../../hooks/useClients", () => ({
  __esModule: true,
  default: () => ({
    clients: mockClients,
    loading: false,
    error: "",
    filter: (options) => jest.requireActual("../../services/clientService").filterClients(mockClients, options),
  }),
}));
jest.mock("../../context/SchedulingContext", () => ({
  useScheduling: () => ({
    appointments: [{ id: "a1", clientId: "c0", scheduledAt: mockSoon.toISOString(), durationMinutes: 60, status: "Confirmed" }],
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ClientsPage />
    </MemoryRouter>
  );

describe("ClientsPage", () => {
  it("is a table with the columns the office scans", () => {
    renderPage();
    ["Client", "Address", "Last visit", "Next visit", "Pest concern", "Status"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("shows each client's next visit, or that none is booked", () => {
    renderPage();
    const row = screen.getByRole("link", { name: "Aaa Bakery" }).closest("tr");
    expect(within(row).queryByText("Not booked")).toBeNull();
    expect(within(row).getByText("Never")).toBeInTheDocument();
  });

  it("pages at 50 and shows more on request", async () => {
    renderPage();
    expect(screen.getAllByRole("row")).toHaveLength(CLIENT_PAGE_SIZE + 1);
    await userEvent.click(screen.getByRole("button", { name: "Show 5 more" }));
    expect(screen.getAllByRole("row")).toHaveLength(CLIENT_PAGE_SIZE + 6);
  });

  it("searches as you type", async () => {
    renderPage();
    await userEvent.type(screen.getByRole("textbox", { name: "Search clients" }), "Aaa");
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("keeps filterClients as the search", () => {
    expect(filterClients(mockClients, { searchTerm: "aaa", classification: "ALL", status: "ACTIVE" })).toHaveLength(1);
  });
});
