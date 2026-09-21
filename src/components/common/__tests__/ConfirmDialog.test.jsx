import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "../ConfirmDialog";

const props = {
  open: true,
  title: "Remove this document?",
  message: "This cannot be undone.",
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => {
  props.onConfirm.mockClear();
  props.onCancel.mockClear();
});

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(<ConfirmDialog {...props} open={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title and message", () => {
    render(<ConfirmDialog {...props} />);

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Remove this document?");
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("confirms and cancels through the footer buttons", async () => {
    render(<ConfirmDialog {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  // This dialog guards destructive actions, and before it was built on Modal
  // there was no way out of it except clicking exactly the right pixels.
  it("cancels on Escape rather than trapping the user", async () => {
    render(<ConfirmDialog {...props} />);

    await userEvent.keyboard("{Escape}");

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("uses custom labels when given them", () => {
    render(<ConfirmDialog {...props} confirmLabel="Deactivate" cancelLabel="Keep active" />);

    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep active" })).toBeInTheDocument();
  });

  // The X and the cancel button must not share an accessible name, or a
  // screen-reader user hears the same control announced twice.
  it("gives the close button a name distinct from the cancel button", () => {
    render(<ConfirmDialog {...props} cancelLabel="Keep active" />);

    expect(screen.getByRole("button", { name: /close dialog/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep active" })).toBeInTheDocument();
  });

  it("never fires the destructive action just by opening", () => {
    render(<ConfirmDialog {...props} tone="danger" />);

    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
