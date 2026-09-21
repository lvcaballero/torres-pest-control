import { isNavItemActive } from "../Sidebar";

const dashboard = { path: "/", exact: true };
const clients = { path: "/clients" };
const scheduling = { path: "/scheduling" };

describe("isNavItemActive", () => {
  it("matches a nav item on its own route", () => {
    expect(isNavItemActive("/clients", clients)).toBe(true);
  });

  // The bug this replaced: an exact-equality check meant a user three clicks
  // deep into a client profile saw the whole sidebar unlit.
  it("keeps the parent lit on a detail route", () => {
    expect(isNavItemActive("/clients/123", clients)).toBe(true);
    expect(isNavItemActive("/clients/123/documents", clients)).toBe(true);
  });

  it("does not light a sibling route that merely shares a prefix", () => {
    expect(isNavItemActive("/clients-archive", clients)).toBe(false);
  });

  it("does not light an unrelated route", () => {
    expect(isNavItemActive("/inventory", clients)).toBe(false);
    expect(isNavItemActive("/clients", scheduling)).toBe(false);
  });

  // "/" prefixes every route in the app, so the dashboard must stay exact or
  // it would be permanently active alongside whatever page you are on.
  it("only matches the dashboard on the root path", () => {
    expect(isNavItemActive("/", dashboard)).toBe(true);
    expect(isNavItemActive("/clients", dashboard)).toBe(false);
    expect(isNavItemActive("/scheduling", dashboard)).toBe(false);
  });
});
