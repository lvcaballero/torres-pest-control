import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SegmentedControl from "../SegmentedControl";

const OPTIONS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "list", label: "List" },
];

/** Controlled wrapper, since the component owns no state of its own. */
function Fixture({ initial = "week", options = OPTIONS, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <SegmentedControl
      ariaLabel="Calendar view"
      options={options}
      value={value}
      onChange={setValue}
      {...props}
    />
  );
}

describe("SegmentedControl", () => {
  it("exposes itself as a radiogroup with one checked option", () => {
    render(<Fixture />);

    expect(screen.getByRole("radiogroup", { name: "Calendar view" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Month" })).not.toBeChecked();
  });

  it("selects an option on click", async () => {
    render(<Fixture />);

    await userEvent.click(screen.getByRole("radio", { name: "Month" }));

    expect(screen.getByRole("radio", { name: "Month" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Week" })).not.toBeChecked();
  });

  it("accepts plain strings as options", () => {
    render(<Fixture initial="Week" options={["Week", "Month"]} />);

    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
  });

  // Only the selected option is a tab stop, so the whole group is one stop in
  // the page's tab order rather than three.
  it("keeps only the selected option in the tab order", () => {
    render(<Fixture />);

    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Month" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves the selection with the arrow keys", async () => {
    render(<Fixture />);
    screen.getByRole("radio", { name: "Week" }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Month" })).toBeChecked();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
  });

  it("wraps around at both ends", async () => {
    render(<Fixture />);
    screen.getByRole("radio", { name: "Week" }).focus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "List" })).toBeChecked();
  });

  it("ignores interaction when disabled", async () => {
    render(<Fixture disabled />);

    await userEvent.click(screen.getByRole("radio", { name: "Month" }));

    expect(screen.getByRole("radio", { name: "Week" })).toBeChecked();
  });
});
