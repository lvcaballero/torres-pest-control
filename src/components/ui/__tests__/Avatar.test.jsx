import { render, screen } from "@testing-library/react";
import Avatar, { AvatarStack, initialsFor } from "../Avatar";

describe("Avatar", () => {
  it("takes up to two initials from the name", () => {
    expect(initialsFor({ name: "Jun Dela Cruz" })).toBe("JD");
    expect(initialsFor({ username: "paolo" })).toBe("P");
  });

  it("renders initials when there is no picture", () => {
    render(<Avatar user={{ name: "Ramon Reyes" }} />);

    expect(screen.getByText("RR")).toBeInTheDocument();
  });

  // Unassigned visits are shown with a question mark, not a blank circle.
  it("shows a question mark for nobody", () => {
    render(<Avatar user={null} />);

    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

describe("AvatarStack", () => {
  it("names the whole crew for screen readers and caps what it draws", () => {
    const crew = [{ id: 1, name: "Jun Dela Cruz" }, { id: 2, name: "Ramon Reyes" }, null, { id: 3, name: "Paolo Garcia" }];
    render(<AvatarStack users={crew} max={2} />);

    expect(screen.getByLabelText("Jun Dela Cruz, Ramon Reyes, Paolo Garcia")).toBeInTheDocument();
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.queryByText("PG")).toBeNull();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
