import { render, screen } from "@testing-library/react";
import StatusPill, { TONES, toneFor } from "../StatusPill";

describe("toneFor", () => {
  it.each([
    ["Completed", "success"],
    ["Cancelled", "neutral"],
    ["Pending", "warning"],
    ["Reschedule", "warning"],
    ["Confirmed", "brand"],
  ])("maps the %s status to the %s tone", (status, tone) => {
    expect(toneFor(status)).toBe(tone);
  });

  it("maps account roles too, so Navbar stops keeping its own palette", () => {
    expect(toneFor("ADMIN")).toBe("brand");
    expect(toneFor("TECHNICIAN")).toBe("success");
  });

  // An unknown role previously spread `undefined` into a style object.
  it("falls back to neutral rather than undefined", () => {
    expect(toneFor("SOMETHING_NEW")).toBe("neutral");
    expect(TONES[toneFor("SOMETHING_NEW")]).toBeDefined();
  });
});

describe("StatusPill", () => {
  it("renders the status it is given", () => {
    render(<StatusPill status="Completed" />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("derives its tone from the status", () => {
    render(<StatusPill status="Completed" />);

    expect(screen.getByText("Completed")).toHaveStyle({ color: TONES.success.color });
  });

  it("lets an explicit tone win over the derived one", () => {
    render(<StatusPill status="Completed" tone="danger" />);

    expect(screen.getByText("Completed")).toHaveStyle({ color: TONES.danger.color });
  });

  it("accepts children instead of a status prop", () => {
    render(<StatusPill>7 visits</StatusPill>);

    expect(screen.getByText("7 visits")).toBeInTheDocument();
  });

  it("renders as a stamp, not a button", () => {
    render(<StatusPill status="Pending" />);

    expect(screen.getByText("Pending")).toHaveStyle({ borderRadius: "9999px" });
  });

  // Colour alone never carries a status: the word is always there, and the
  // dot is what reads at a glance.
  it("pairs the word with a status dot", () => {
    render(<StatusPill status="Pending" />);

    const pill = screen.getByText("Pending");
    expect(pill.querySelector("[data-status-dot]")).not.toBeNull();
  });

  it("drops the dot when asked, for a plain label", () => {
    render(<StatusPill dot={false}>Commercial</StatusPill>);

    expect(screen.getByText("Commercial").querySelector("[data-status-dot]")).toBeNull();
  });

  it("maps stock and signature states, not just appointments", () => {
    expect(toneFor("Low stock")).toBe("danger");
    expect(toneFor("Signed")).toBe("success");
    expect(toneFor("No signature")).toBe("warning");
  });
});
