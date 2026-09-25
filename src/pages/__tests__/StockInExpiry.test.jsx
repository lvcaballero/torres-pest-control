// Expiration date and lot number on the Stock In line (migration 048).
//
// They belong to a delivery, not to the product, so they are asked for on each
// chemical line and nowhere else: equipment and materials do not expire.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BulkStockInModal } from "../InventoryPage";
import { todayISO } from "../../utils/validators";

const inventory = [
  { id: "c1", name: "Termidor SC", type: "CHEMICAL", unit: "L", status: "ACTIVE", quantity: 10, cost: 100 },
  { id: "e1", name: "Sprayer", type: "EQUIPMENT", unit: "pcs", status: "ACTIVE", quantity: 1, cost: 500 },
];

function renderModal(initialItemId, onSubmit = jest.fn(async () => {})) {
  render(<BulkStockInModal inventory={inventory} initialItemId={initialItemId} onClose={() => {}} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByLabelText("Stock In quantity"), { target: { value: "5" } });
  fireEvent.change(document.getElementById("stock-in-reference"), { target: { value: "PO-1" } });
  fireEvent.change(document.getElementById("stock-in-intake"), { target: { value: "Main" } });
  return onSubmit;
}

describe("Stock In expiry", () => {
  it("asks for lot and expiry on a chemical line and sends them", async () => {
    const onSubmit = renderModal("c1");
    fireEvent.change(screen.getByLabelText("Lot number"), { target: { value: " L25-0142 " } });
    fireEvent.change(screen.getByLabelText("Expiration date"), { target: { value: "2099-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0][0]).toMatchObject({ itemId: "c1", batchNumber: "L25-0142", expirationDate: "2099-01-31" });
  });

  it("does not ask on an equipment line", () => {
    renderModal("e1");
    expect(screen.queryByLabelText("Expiration date")).toBeNull();
    expect(screen.queryByLabelText("Lot number")).toBeNull();
  });

  it("refuses an expiry before the delivery date", () => {
    const onSubmit = renderModal("c1");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    fireEvent.change(screen.getByLabelText("Expiration date"), { target: { value: todayISO(yesterday) } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("The expiration date for Termidor SC is before the delivery date.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
