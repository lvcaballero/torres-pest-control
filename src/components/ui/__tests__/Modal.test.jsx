import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "../Modal";

/** A dialog with two focusable controls, for the focus-trap tests. */
function Fixture({ onClose = () => {}, ...props }) {
  return (
    <Modal title="New appointment" onClose={onClose} {...props}>
      <input aria-label="Client" />
      <button type="button">Inner action</button>
    </Modal>
  );
}

describe("Modal", () => {
  it("renders as a labelled modal dialog", () => {
    render(<Fixture />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("New appointment");
  });

  it("renders nothing when closed", () => {
    render(<Fixture open={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = jest.fn();
    render(<Fixture onClose={onClose} />);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a click that starts and ends on the backdrop", async () => {
    const onClose = jest.fn();
    render(<Fixture onClose={onClose} />);

    await userEvent.click(screen.getByRole("presentation"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Releasing a drag-selection outside the panel must not discard a
  // half-filled form, which is why the handler is on mousedown and checks
  // that the event started on the backdrop.
  it("does not close when the click starts inside the panel", async () => {
    const onClose = jest.fn();
    render(<Fixture onClose={onClose} />);

    await userEvent.click(screen.getByLabelText("Client"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the header close button", async () => {
    const onClose = jest.fn();
    render(<Fixture onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /close dialog/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The close button is first in document order, but landing the user on the
  // X is useless — focus belongs on the first field they actually came to
  // fill in.
  it("moves focus to the first control in the body, not the close button", () => {
    render(<Fixture />);

    expect(screen.getByLabelText("Client")).toHaveFocus();
  });

  it("honours an explicit initial focus target", () => {
    function WithInitialFocus() {
      const ref = useRef(null);
      return (
        <Modal title="Pick one" onClose={() => {}} initialFocusRef={ref}>
          <input aria-label="First" />
          <input aria-label="Second" ref={ref} />
        </Modal>
      );
    }

    render(<WithInitialFocus />);

    expect(screen.getByLabelText("Second")).toHaveFocus();
  });

  // Without a trap, Tab walks out of the dialog into the page behind the
  // overlay, where nothing is visible to click. Document order inside the
  // panel is Close (header), Client, Inner action.
  it("wraps Tab from the last control back to the first", async () => {
    render(<Fixture />);

    await userEvent.tab(); // Client -> Inner action (the last focusable)
    expect(screen.getByRole("button", { name: "Inner action" })).toHaveFocus();

    await userEvent.tab(); // wraps back to the first, the close button

    expect(screen.getByRole("button", { name: /close dialog/i })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first control to the last", async () => {
    render(<Fixture />);
    screen.getByRole("button", { name: /close dialog/i }).focus();

    await userEvent.tab({ shift: true });

    expect(screen.getByRole("button", { name: "Inner action" })).toHaveFocus();
  });

  it("locks page scroll while open and restores it on unmount", () => {
    const { unmount } = render(<Fixture />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("returns focus to whatever opened it", async () => {
    function Host() {
      const [open, setOpen] = require("react").useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && (
            <Modal title="Sheet" onClose={() => setOpen(false)}>
              <input aria-label="Client" />
            </Modal>
          )}
        </>
      );
    }

    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });

    await userEvent.click(opener);
    await userEvent.keyboard("{Escape}");

    expect(opener).toHaveFocus();
  });

  it("renders an eyebrow and a footer when given them", () => {
    render(
      <Modal title="Sheet" eyebrow="Scheduling" onClose={() => {}} footer={<button type="button">Create</button>}>
        body
      </Modal>
    );

    expect(screen.getByText("Scheduling")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});
