import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toast from "../Toast";

describe("Toast", () => {
  it("offers its action and dismisses itself once it runs", async () => {
    const onClick = jest.fn();
    const onDismiss = jest.fn();
    render(<Toast message="Moved to Sep 26." action={{ label: "Undo", onClick }} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has no action button unless given one", () => {
    render(<Toast message="Saved." onDismiss={() => {}} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});
