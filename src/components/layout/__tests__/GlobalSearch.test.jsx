import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalSearchBox } from "../GlobalSearch";
import { scoreMatch, searchEverything } from "../../../utils/globalSearch";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));

const clients = [
  { id: "c1", name: "Cruz Bakery", reference: "CL-2026-0004", address: "Katipunan" },
  { id: "c2", name: "Jollibee Katipunan", reference: "CL-2026-0001", address: "10 Katipunan Ave" },
  { id: "c3", name: "Tan Family Home", reference: "CL-2026-0002", address: "Marikina" },
];
const appointments = [
  { id: "a1", clientId: "c3", scheduledAt: "2026-09-25T08:00:00", serviceType: "General Pest Control", status: "Confirmed", technicianId: "u1", technicianIds: ["u1"] },
];
const inventory = [{ id: "i1", name: "Termidor SC", type: "CHEMICAL", quantity: 4.5, unit: "L", supplier: "Planters" }];
const users = [{ id: "u1", name: "Jun Dela Cruz", reference: "TEC-0001", role: "TECHNICIAN", status: "ACTIVE" }];

describe("scoreMatch", () => {
  it("needs every word to match somewhere", () => {
    expect(scoreMatch("cruz bakery", ["Cruz Bakery"])).toBeGreaterThan(0);
    expect(scoreMatch("cruz chapel", ["Cruz Bakery"])).toBe(0);
  });

  it("ranks a prefix above a substring", () => {
    expect(scoreMatch("kati", ["Katipunan"])).toBeGreaterThan(scoreMatch("puna", ["Katipunan"]));
  });
});

describe("searchEverything", () => {
  it("finds a client by reference number", () => {
    const groups = searchEverything("CL-2026-0001", { clients });
    expect(groups[0].results.map((result) => result.id)).toEqual(["c2"]);
    expect(groups[0].results[0].to).toBe("/clients/c2");
  });

  it("finds visits by client name, and technicians by TEC- number", () => {
    const groups = searchEverything("tan", { clients, appointments, users });
    const visits = groups.find((group) => group.key === "visits");
    expect(visits.results[0].to).toBe("/scheduling?appointment=a1");

    const accounts = searchEverything("TEC-0001", { users }).find((group) => group.key === "accounts");
    expect(accounts.results[0].label).toBe("Jun Dela Cruz");
  });

  // A list passed as null is one this user may not open.
  it("never searches a list the user cannot see", () => {
    const groups = searchEverything("termidor", { clients, inventory: null });
    expect(groups).toEqual([]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchEverything("   ", { clients })).toEqual([]);
  });
});

describe("GlobalSearchBox", () => {
  beforeEach(() => mockNavigate.mockClear());

  const sources = { clients, appointments, inventory, users };

  it("lists grouped results as you type", async () => {
    render(<GlobalSearchBox sources={sources} />);

    await userEvent.type(screen.getByRole("combobox"), "katipunan");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Clients" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeGreaterThanOrEqual(2);
  });

  it("moves through results with the arrow keys and opens one with Enter", async () => {
    render(<GlobalSearchBox sources={sources} />);
    const box = screen.getByRole("combobox");

    await userEvent.type(box, "katipunan");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await userEvent.type(box, "{arrowdown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    await userEvent.type(box, "{enter}");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("says so when nothing matches", async () => {
    render(<GlobalSearchBox sources={sources} />);

    await userEvent.type(screen.getByRole("combobox"), "zzzz");

    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("focuses on Ctrl K from anywhere", async () => {
    render(<GlobalSearchBox sources={sources} />);

    await userEvent.keyboard("{Control>}k{/Control}");

    expect(screen.getByRole("combobox")).toHaveFocus();
  });
});
