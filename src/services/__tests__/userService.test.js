// The role a save lands on must come from the server, not from what we sent.
//
// update_role_account() can move an account to another role table (migration
// 045) and returns the row it landed in tagged with its new role. Mapping the
// response with the role we *sent* pinned the answer to the old one, so
// AuthContext dropped the account back into the collection it came from and
// the change only showed after a page reload.

import { updateAccount, mapAccountRow } from "../userService";
import { supabase } from "../supabaseClient";

jest.mock("../supabaseClient", () => ({
  supabase: { rpc: jest.fn() },
}));

const technician = { id: "acc-1", name: "Eduardo Lim", role: "TECHNICIAN" };

beforeEach(() => jest.clearAllMocks());

describe("mapAccountRow", () => {
  it("falls back to the row's own role when none is given", () => {
    expect(mapAccountRow({ id: "a", role: "STAFF" }).role).toBe("STAFF");
  });
});

describe("updateAccount", () => {
  it("reports the role the server moved the account to", async () => {
    // What update_role_account returns after delegating to move_account_role.
    supabase.rpc.mockResolvedValue({
      data: { id: "acc-1", name: "Eduardo Lim", email: "e@tpc.ph", status: "ACTIVE", role: "STAFF", moved: true },
      error: null,
    });

    const { account } = await updateAccount("token", technician, {
      name: "Eduardo Lim", email: "e@tpc.ph", phone: "09171234567", role: "STAFF",
    });

    expect(account.role).toBe("STAFF");
    expect(account.id).toBe("acc-1");
  });

  it("keeps the account's role when the response carries none", async () => {
    supabase.rpc.mockResolvedValue({
      data: { id: "acc-1", name: "Eduardo Lim", status: "ACTIVE" },
      error: null,
    });

    const { account } = await updateAccount("token", technician, { name: "Eduardo Lim" });

    expect(account.role).toBe("TECHNICIAN");
  });

  it("sends the role through to the RPC", async () => {
    supabase.rpc.mockResolvedValue({ data: { id: "acc-1", role: "STAFF" }, error: null });

    await updateAccount("token", technician, { name: "X", email: "x@t.ph", phone: "", role: "STAFF" });

    expect(supabase.rpc).toHaveBeenCalledWith("update_role_account", expect.objectContaining({ new_role: "STAFF" }));
  });

  it("returns the server's message on failure", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "You cannot change your own role." } });

    const { error } = await updateAccount("token", technician, { role: "STAFF" });

    expect(error).toMatch(/cannot change your own role/);
  });
});
