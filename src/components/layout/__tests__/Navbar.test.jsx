import { render, screen } from "@testing-library/react";
import Navbar from "../Navbar";

const mockAuth = { currentUser: { name: "Karl Hameed", role: "ADMIN" } };

jest.mock("../../../hooks/useAuth", () => ({
  __esModule: true,
  default: () => ({ currentUser: mockAuth.currentUser, logout: jest.fn() }),
}));

jest.mock("../../../context/NotificationsContext", () => ({
  useNotifications: () => ({ notifications: [], unreadCount: 0, markAllRead: jest.fn() }),
}));

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));

beforeEach(() => {
  mockAuth.currentUser = { name: "Karl Hameed", role: "ADMIN" };
  jest.useFakeTimers();
  // Pinned, or the assertion below would start failing in December.
  jest.setSystemTime(new Date(2026, 8, 21, 9, 30));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Navbar dateline", () => {
  // Field-by-field rather than a fixed string: toLocaleDateString follows the
  // viewer's locale, so the day and month swap places between en-US and en-GB.
  // Pinning one ordering would only assert which machine ran the suite.
  it("fills the left slot with today's date, uppercased", () => {
    render(<Navbar />);

    const dateline = screen.getByText(/SEPTEMBER/);
    expect(dateline.tagName).toBe("TIME");
    expect(dateline.textContent).toMatch(/\bMON\b/);
    expect(dateline.textContent).toMatch(/\b21\b/);
    expect(dateline.textContent).toMatch(/\b2026\b/);
    expect(dateline.textContent).toBe(dateline.textContent.toUpperCase());
  });

  // Built from the local calendar fields, not toISOString(), which converts to
  // UTC first and reads as yesterday for anyone west of Greenwich after 4pm.
  it("carries a machine-readable local date", () => {
    render(<Navbar />);

    expect(screen.getByText(/SEPTEMBER/)).toHaveAttribute("dateTime", "2026-09-21");
  });

  it("renders nothing at all when no one is signed in", () => {
    mockAuth.currentUser = null;
    const { container } = render(<Navbar />);

    expect(container).toBeEmptyDOMElement();
  });
});
