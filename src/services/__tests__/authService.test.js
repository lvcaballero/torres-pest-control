import { loadSession, login, saveSession } from "../authService";
import { supabase } from "../supabaseClient";

jest.mock("../supabaseClient", () => ({ supabase: { rpc: jest.fn() } }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("login error messages", () => {
  // The form used to print Postgres codes and "Run supabase/schema-v2.sql".
  it("never shows backend detail to the person signing in", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "42883", message: "function crypt(text, text) does not exist", hint: "No function matches" },
    });

    const { error } = await login("jun", "pw");

    expect(error).not.toMatch(/42883|crypt|schema|sql|hint|code/i);
    expect(error).toMatch(/administrator/);
    expect(console.error).toHaveBeenCalled();
  });

  it("keeps the old-function case generic too", async () => {
    supabase.rpc.mockResolvedValue({ data: [{ id: 1, role: "ADMIN" }], error: null });

    const { error } = await login("jun", "pw");

    expect(error).not.toMatch(/schema|migration/i);
  });

  it("says a wrong password is wrong without saying which field", async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    expect((await login("jun", "pw")).error).toBe("Invalid email or password.");
  });
});

describe("session persistence", () => {
  it("keeps a remembered session in localStorage", () => {
    saveSession({ token: "t", remember: true });

    expect(localStorage.getItem("torres_session")).toContain("t");
    expect(sessionStorage.getItem("torres_session")).toBeNull();
    expect(loadSession().token).toBe("t");
  });

  it("keeps an unremembered session only for this browser session", () => {
    saveSession({ token: "u", remember: false });

    expect(localStorage.getItem("torres_session")).toBeNull();
    expect(loadSession().token).toBe("u");
  });

  it("clears both on sign-out", () => {
    saveSession({ token: "t", remember: true });
    saveSession(null);

    expect(loadSession()).toBeNull();
  });

  // Sessions saved before this change carry no `remember` flag.
  it("treats an old session with no flag as remembered", () => {
    saveSession({ token: "old" });

    expect(localStorage.getItem("torres_session")).toContain("old");
  });
});
