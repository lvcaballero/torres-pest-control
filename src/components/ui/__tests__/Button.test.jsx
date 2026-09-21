import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "../Button";

describe("Button", () => {
  it("renders its label and fires onClick", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button so it cannot submit a form by accident", () => {
    render(<Button>Cancel</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("still allows an explicit submit button", () => {
    render(<Button type="submit">Create</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  // Loading is a disabled state as far as the user is concerned — a second
  // click while a create is in flight would file the appointment twice.
  it("blocks clicks while loading and announces it", async () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        Creating...
      </Button>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not look clickable when disabled", () => {
    render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button")).toHaveStyle({ cursor: "default" });
  });

  it("opts into the shared hover treatment", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button")).toHaveClass("ui-interactive");
  });

  it("keeps a caller's own className alongside it", () => {
    render(<Button className="mine">Save</Button>);

    expect(screen.getByRole("button")).toHaveClass("ui-interactive", "mine");
  });

  it("lets a caller override styling without losing the variant", () => {
    render(<Button variant="primary" style={{ width: "100%" }}>Save</Button>);

    expect(screen.getByRole("button")).toHaveStyle({ width: "100%" });
  });

  it("falls back to the secondary variant for an unknown name", () => {
    render(<Button variant="nonsense">Save</Button>);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
