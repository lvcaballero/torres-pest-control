import { render, screen } from "@testing-library/react";
import { PieChart, whenLabel } from "../DashboardParts";
import { recentDetail } from "../OfficeDashboard";

jest.mock("../../../hooks/useAuth", () => ({ __esModule: true, default: () => ({}) }));
jest.mock("../../../hooks/useClients", () => ({ __esModule: true, default: () => ({ clients: [] }) }));
jest.mock("../../../hooks/useUsers", () => ({ __esModule: true, default: () => ({ users: [] }) }));
jest.mock("../../../context/SchedulingContext", () => ({ useScheduling: () => ({ appointments: [] }) }));
jest.mock("../../../context/InventoryContext", () => ({ useInventoryContext: () => ({ inventory: [], movements: [] }) }));

describe("whenLabel", () => {
  const now = new Date(2026, 8, 25, 9, 12);

  it("puts the day on every row", () => {
    expect(whenLabel(new Date(2026, 8, 25, 8, 0), now)).toMatch(/^Today · 8:00/);
    expect(whenLabel(new Date(2026, 8, 24, 16, 30), now)).toMatch(/^Yesterday · 4:30/);
    expect(whenLabel(new Date(2026, 8, 22, 9, 0), now)).toMatch(/^Sep 22 · 9:00/);
  });
});

describe("recentDetail", () => {
  it("only says signed-by when there is a signature", () => {
    expect(recentDetail({ reportSubmitted: true, customerName: "Store Manager", signaturePath: "" }, ["Jun"])).toBe(
      "Jun · no customer signature"
    );
    expect(recentDetail({ reportSubmitted: true, customerName: "Mrs Tan", signaturePath: "s.png" }, ["Ramon"])).toBe(
      "Ramon · signed by Mrs Tan"
    );
  });
});

describe("PieChart", () => {
  it("names what its total counts, and can say why it differs", () => {
    render(
      <PieChart
        rows={[{ label: "Jun", value: 3 }, { label: "Ramon", value: 2 }]}
        centerLabel="assignments"
        caption="A visit with a crew counts once per technician."
      />
    );

    expect(screen.getByText("assignments")).toBeInTheDocument();
    expect(screen.getByText(/counts once per technician/)).toBeInTheDocument();
  });
});
