import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileMenu from "../ProfileMenu";
import { initialsFor } from "../Avatar";

const user = { name: "Karl Hameed", username: "karl", role: "TECHNICIAN" };

const props = {
  user,
  open: false,
  onToggle: jest.fn(),
  onNavigate: jest.fn(),
  onLogout: jest.fn(),
};

beforeEach(() => {
  props.onToggle.mockClear();
  props.onNavigate.mockClear();
  props.onLogout.mockClear();
});

describe("initialsFor", () => {
  it("takes up to two initials from a display name", () => {
    expect(initialsFor({ name: "Karl Hameed" })).toBe("KH");
    expect(initialsFor({ name: "Alejandro Ruiz Perez" })).toBe("AR");
  });

  it("falls back to the username, then to a placeholder", () => {
    expect(initialsFor({ username: "bruce" })).toBe("B");
    expect(initialsFor({})).toBe("U");
    expect(initialsFor(null)).toBe("U");
  });

  it("ignores the extra spaces a pasted name brings with it", () => {
    expect(initialsFor({ name: "  Karl   Hameed " })).toBe("KH");
  });
});

describe("ProfileMenu", () => {
  it("shows the signed-in user and their role on the trigger", () => {
    render(<ProfileMenu {...props} />);

    expect(screen.getByText("Karl Hameed")).toBeInTheDocument();
    expect(screen.getByText("TECHNICIAN")).toBeInTheDocument();
  });

  it("keeps the dropdown closed until asked", () => {
    render(<ProfileMenu {...props} />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("reports a toggle rather than opening itself", async () => {
    render(<ProfileMenu {...props} />);

    await userEvent.click(screen.getByRole("button"));

    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it("offers the account actions when open", () => {
    render(<ProfileMenu {...props} open />);

    expect(screen.getByRole("menuitem", { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /logout/i })).toBeInTheDocument();
  });

  it("routes to the account page and to the security tab", async () => {
    render(<ProfileMenu {...props} open />);

    await userEvent.click(screen.getByRole("menuitem", { name: /edit profile/i }));
    expect(props.onNavigate).toHaveBeenCalledWith("/account");

    await userEvent.click(screen.getByRole("menuitem", { name: /change password/i }));
    expect(props.onNavigate).toHaveBeenCalledWith("/account?tab=security");
  });

  it("logs out", async () => {
    render(<ProfileMenu {...props} open />);

    await userEvent.click(screen.getByRole("menuitem", { name: /logout/i }));

    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  // The palette this replaced was indexed unguarded, so a role outside the
  // three known ones spread `undefined` into the style object.
  it("renders a role it has never seen without breaking", () => {
    render(<ProfileMenu {...props} user={{ ...user, role: "DISPATCHER" }} />);

    expect(screen.getByText("DISPATCHER")).toBeInTheDocument();
  });

  it("falls back to the username when there is no display name", () => {
    render(<ProfileMenu {...props} user={{ username: "bruce", role: "STAFF" }} />);

    expect(screen.getByText("bruce")).toBeInTheDocument();
  });
});
