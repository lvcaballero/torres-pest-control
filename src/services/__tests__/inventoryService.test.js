import { stockInBatch } from "../inventoryService";
import { supabase } from "../supabaseClient";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const header = { date: "2026-09-25", reference: "PO-1", intakeBranchOrStation: "Main", idempotencyKey: "k1" };
const savedRow = {
  movement_id: "m1", item_id: "i1", amount: 5, movement_date: "2026-09-25", reference: "PO-1",
  actor: "Ana", unit_cost: 10, total_cost: 50, created_at: "2026-09-25T01:00:00Z", new_quantity: 15,
};

describe("stockInBatch", () => {
  beforeEach(() => supabase.rpc.mockReset());

  it("sends each delivery line's expiry date to stock_in_batch", async () => {
    supabase.rpc.mockResolvedValue({ data: [{ ...savedRow, expiration_date: "2027-03-01" }], error: null });
    const result = await stockInBatch(
      [
        { itemId: "i1", amount: 5, unitCost: 10, expirationDate: "2027-03-01" },
        { itemId: "i2", amount: 1, unitCost: 3 },
      ],
      header
    );
    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_items[0].expiration_date).toBe("2027-03-01");
    expect(params.p_items[1].expiration_date).toBeNull();
    expect(result.movements[0].expirationDate).toBe("2027-03-01");
  });

  it("leaves the expiry undefined when the database predates migration 049", async () => {
    supabase.rpc.mockResolvedValue({ data: [savedRow], error: null });
    const result = await stockInBatch([{ itemId: "i1", amount: 5 }], header);
    expect(result.movements[0].expirationDate).toBeUndefined();
  });
});
