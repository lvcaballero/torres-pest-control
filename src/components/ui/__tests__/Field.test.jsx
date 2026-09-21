import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Field from "../Field";
import Input from "../Input";
import Select from "../Select";

describe("Field", () => {
  it("associates its label with the control it wraps", async () => {
    render(
      <Field label="Service location">
        <Input />
      </Field>
    );

    await userEvent.click(screen.getByText("Service location"));

    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("shows a hint when there is no error", () => {
    render(
      <Field label="Notes" hint="Optional">
        <Input />
      </Field>
    );

    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  // An error is the more urgent message, so it replaces the hint rather than
  // stacking two lines of small text under the control.
  it("replaces the hint with the error when both are given", () => {
    render(
      <Field label="Client" hint="Search by name" error="Select a client from the list.">
        <Input />
      </Field>
    );

    expect(screen.queryByText("Search by name")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Select a client from the list.");
  });

  it("marks a required field", () => {
    render(
      <Field label="Date and time" required>
        <Input />
      </Field>
    );

    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Input and Select", () => {
  it("flags an invalid input for assistive technology", () => {
    render(<Input invalid aria-label="Hours" />);

    expect(screen.getByLabelText("Hours")).toHaveAttribute("aria-invalid", "true");
  });

  it("leaves a valid input unflagged", () => {
    render(<Input aria-label="Hours" />);

    expect(screen.getByLabelText("Hours")).not.toHaveAttribute("aria-invalid");
  });

  it("forwards a ref so callers can focus the control", () => {
    const ref = { current: null };
    render(<Input ref={ref} aria-label="Client" />);

    ref.current.focus();
    expect(screen.getByLabelText("Client")).toHaveFocus();
  });

  it("renders select options and reports the choice", async () => {
    render(
      <Select aria-label="Technician" defaultValue="">
        <option value="">Unassigned</option>
        <option value="t1">Karl Hameed</option>
      </Select>
    );

    await userEvent.selectOptions(screen.getByLabelText("Technician"), "t1");

    expect(screen.getByLabelText("Technician")).toHaveValue("t1");
  });
});
