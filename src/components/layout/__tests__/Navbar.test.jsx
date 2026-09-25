import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar, { localDateValue } from "../Navbar";

const mockAuth = { currentUser: { name: "Karl Hameed", role: "ADMIN" }, canBook: true };
const mockNavigate = jest.fn();

jest.mock("../../../hooks/useAuth", () => ({
  __esModule: true,
  default: () => ({ currentUser: mockAuth.currentUser, can: () => mockAuth.canBook, logout: jest.fn() }),
}));

jest.mock("../../../context/NotificationsContext", () => ({
  useNotifications: () => ({ notifications: [], unreadCount: 0, markAllRead: jest.fn() }),
}));

jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));

// The real search reads four contexts; the bar's own behaviour is what's
// under test here, so a stand-in is passed through the `search` slot.
const renderBar = (props = {}) => render(<Navbar search={<div>search</div>} {...props} />);

beforeEach(() => {
  mockAuth.currentUser = { name: "Karl Hameed", role: "ADMIN" };
  mockAuth.canBook = true;
  mockNavigate.mockClear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 8, 21, 9, 30));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Navbar", () => {
  it("shows today's date as a machine-readable local date", () => {
    renderBar();

    const date = screen.getByText(/Sep/);
    expect(date.tagName).toBe("TIME");
    expect(date).toHaveAttribute("dateTime", "2026-09-21");
  });

  // Built from the local calendar fields, not toISOString(), which converts to
  // UTC first and reads as yesterday for anyone west of Greenwich after 4pm.
  it("builds the date value from local fields", () => {
    expect(localDateValue(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("offers New visit to someone who can book, and sends them to the form", async () => {
    jest.useRealTimers();
    renderBar();

    await userEvent.click(screen.getByRole("button", { name: "New visit" }));

    expect(mockNavigate).toHaveBeenCalledWith("/scheduling?new=1");
  });

  it("hides New visit from someone who cannot book", () => {
    mockAuth.canBook = false;
    renderBar();

    expect(screen.queryByRole("button", { name: "New visit" })).toBeNull();
  });

  it("shows the drawer button only when the shell provides one", () => {
    const { rerender } = renderBar();
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull();

    rerender(<Navbar search={<div />} onOpenMenu={() => {}} />);
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  });

  it("renders nothing at all when no one is signed in", () => {
    mockAuth.currentUser = null;
    const { container } = renderBar();

    expect(container).toBeEmptyDOMElement();
  });
});
