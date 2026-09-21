import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationMenu from "../NotificationMenu";

const notifications = [
  { id: "n1", message: "Visit confirmed for Rhey Garcia", createdAt: "2026-09-21T09:00:00", readAt: null, appointmentId: "a1" },
  { id: "n2", message: "Report filed", createdAt: "2026-09-20T15:30:00", readAt: "2026-09-20T16:00:00" },
];

const props = {
  notifications,
  unreadCount: 1,
  open: false,
  onToggle: jest.fn(),
  onOpenNotification: jest.fn(),
};

beforeEach(() => {
  props.onToggle.mockClear();
  props.onOpenNotification.mockClear();
});

describe("NotificationMenu", () => {
  it("announces the unread count in the bell's label", () => {
    render(<NotificationMenu {...props} />);

    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();
  });

  it("drops the count from the label when everything is read", () => {
    render(<NotificationMenu {...props} unreadCount={0} />);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("caps the badge at 9+ so it cannot stretch the bell", () => {
    render(<NotificationMenu {...props} unreadCount={14} />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("stays closed until asked", () => {
    render(<NotificationMenu {...props} />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("lists notifications when open", () => {
    render(<NotificationMenu {...props} open />);

    expect(screen.getByText("Visit confirmed for Rhey Garcia")).toBeInTheDocument();
    expect(screen.getByText("Report filed")).toBeInTheDocument();
  });

  it("says so when there is nothing to show", () => {
    render(<NotificationMenu {...props} notifications={[]} unreadCount={0} open />);

    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });

  it("hands the chosen notification back to the caller", async () => {
    render(<NotificationMenu {...props} open />);

    await userEvent.click(screen.getByRole("menuitem", { name: /Rhey Garcia/ }));

    expect(props.onOpenNotification).toHaveBeenCalledWith(notifications[0]);
  });
});
