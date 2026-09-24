import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Sidebar, { groupHeadingId, isNavItemActive } from "../Sidebar";
import { can } from "../../../utils/permissions";
import { brand } from "../../../styles/tokens";

// A jest.mock factory may only close over variables whose names begin with
// "mock" — it is hoisted above the imports.
const mockAuth = { role: "ADMIN" };

jest.mock("../../../hooks/useAuth", () => ({
  __esModule: true,
  default: () => ({
    currentUser: { role: mockAuth.role },
    // The real matrix, not a stub: the point of these tests is that the rail
    // is driven by permissions, so faking can() would test nothing.
    can: (subsystem, action = "view") =>
      // eslint-disable-next-line global-require
      require("../../../utils/permissions").can(mockAuth.role, subsystem, action),
  }),
}));

function renderSidebar(pathname = "/", role = "ADMIN") {
  mockAuth.role = role;
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Sidebar />
    </MemoryRouter>
  );
}

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

describe("Sidebar groups", () => {
  it("shows all three groups to an admin", () => {
    renderSidebar("/", "ADMIN");

    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /User Accounts/ })).toBeInTheDocument();
  });

  // The regression: filtering the items without then dropping the empty group
  // leaves an "Administration" heading floating above nothing.
  it.each(["TECHNICIAN", "STAFF"])(
    "drops the whole Administration group for a %s, not just its links",
    (role) => {
      renderSidebar("/", role);

      expect(can(role, "users")).toBe(false);
      expect(can(role, "settings")).toBe(false);

      expect(screen.queryByText("Administration")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /User Accounts/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Treatment Methods/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Services/ })).not.toBeInTheDocument();

      // …while the groups they can use are untouched.
      expect(screen.getByText("Operations")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Scheduling/ })).toBeInTheDocument();
    }
  );

  it("labels each group's list by its heading, so the grouping reaches a screen reader", () => {
    renderSidebar("/", "ADMIN");

    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(3);

    lists.forEach((list) => {
      const headingId = list.getAttribute("aria-labelledby");
      expect(headingId).toBeTruthy();
      expect(document.getElementById(headingId)).toBeInTheDocument();
    });

    const operations = lists.find(
      (list) => list.getAttribute("aria-labelledby") === groupHeadingId("Operations")
    );
    expect(within(operations).getAllByRole("link")).toHaveLength(5);
  });

  // Team lead's request: the service catalog and the treatment checklist are
  // operational data, so they live under Operations, not Administration.
  it("lists Services and Treatment Methods under Operations for an admin", () => {
    renderSidebar("/", "ADMIN");

    const operations = screen.getAllByRole("list").find(
      (list) => list.getAttribute("aria-labelledby") === groupHeadingId("Operations")
    );
    const administration = screen.getAllByRole("list").find(
      (list) => list.getAttribute("aria-labelledby") === groupHeadingId("Administration")
    );

    expect(within(operations).getByRole("link", { name: /Services/ })).toHaveAttribute("href", "/services");
    expect(within(operations).getByRole("link", { name: /Treatment Methods/ })).toHaveAttribute("href", "/treatment-methods");
    expect(within(administration).queryByRole("link", { name: /Treatment Methods/ })).not.toBeInTheDocument();
  });
});

describe("Sidebar active state", () => {
  it("marks exactly one link as the current page on a detail route", () => {
    renderSidebar("/clients/123", "ADMIN");

    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Client Profiles");
  });

  // Asserted against the token, never a literal hex, so the test tracks the
  // design system rather than pinning a colour it does not own.
  it("paints the active item's left marker in the brand colour and leaves the rest transparent", () => {
    renderSidebar("/scheduling", "ADMIN");

    const active = screen.getByRole("link", { name: /Scheduling/ });
    expect(active).toHaveStyle({ borderLeftColor: brand.base, background: brand.wash });

    const inactive = screen.getByRole("link", { name: /Dashboard/ });
    expect(inactive).toHaveStyle({ borderLeftColor: "transparent" });
  });

  // The marker is on every item, active or not, so lighting one up cannot
  // shove its label sideways.
  it("reserves the marker's width on every item", () => {
    renderSidebar("/scheduling", "ADMIN");

    screen.getAllByRole("link").forEach((link) => {
      expect(link).toHaveStyle({ borderLeftWidth: "3px" });
    });
  });
});

// Regression: every tab you had visited kept a 3px marker forever.
//
// styles.link used the `borderLeft` shorthand while styles.activeLink set the
// `borderLeftColor` longhand. CSS expands a shorthand into longhands at parse
// time, so once React had written borderLeftColor for the active item, going
// inactive made it remove that key by assigning "" — which deletes the
// declaration rather than restoring the shorthand's transparent, leaving
// border-left-color at its initial value of currentColor. Measured in
// Chromium: rgb(80, 70, 60), the link's own text colour, which is exactly
// what the reported screenshot showed.
describe("the active marker does not stick to visited items", () => {
  it("restores a transparent marker when an item stops being active", async () => {
    renderSidebar("/clients");

    const clients = () => screen.getByRole("link", { name: /Client Profiles/ });
    expect(clients().style.borderLeftColor).toBe(brand.base);

    // Navigate for real, inside the same router, so React updates the nodes
    // rather than remounting them. (Re-rendering MemoryRouter with different
    // initialEntries does NOT navigate — it ignores them after mount.)
    await userEvent.click(screen.getByRole("link", { name: /Inventory/ }));

    // The value that matters: an empty string here is the bug, because the
    // browser then falls back to currentColor.
    expect(clients().style.borderLeftColor).toBe("transparent");
    expect(clients()).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Inventory/ }).style.borderLeftColor).toBe(brand.base);
  });

  it("leaves a never-visited item transparent", () => {
    renderSidebar("/clients");
    expect(screen.getByRole("link", { name: /Dashboard/ }).style.borderLeftColor).toBe("transparent");
  });
});
