// Primary navigation.
//
// Nav items are derived from the permission matrix rather than a hardcoded
// `role === "ADMIN"` check, so a link appears exactly when the route behind it
// is reachable. RoleBasedRoute does the actual enforcing — this only decides
// what to show.

import { Link, useLocation } from "react-router-dom";
import {
  BriefcaseBusiness,
  CalendarDays,
  Gauge,
  ListChecks,
  Package,
  Users,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { SUBSYSTEMS } from "../../utils/permissions";
import { brand, layout, radius, text, weight } from "../../styles/tokens";

const NAV_ITEMS = [
  // The dashboard is the only exact match — "/" prefixes every other route.
  { label: "Dashboard", path: "/", exact: true, subsystem: null, Icon: Gauge },
  { label: "Client Profiles", path: "/clients", subsystem: SUBSYSTEMS.CLIENTS, action: "view", Icon: BriefcaseBusiness },
  { label: "User Accounts", path: "/users", subsystem: SUBSYSTEMS.USERS, action: "view", Icon: Users },
  { label: "Inventory", path: "/inventory", subsystem: SUBSYSTEMS.INVENTORY, action: "view", Icon: Package },
  { label: "Scheduling", path: "/scheduling", subsystem: SUBSYSTEMS.SCHEDULING, action: "view", Icon: CalendarDays },
  { label: "Treatment Methods", path: "/treatment-methods", subsystem: SUBSYSTEMS.SETTINGS, action: "view", Icon: ListChecks },
];

/**
 * Whether a nav item should read as the current page.
 *
 * This used to be `location.pathname === item.path`, which meant a detail
 * route like /clients/123 highlighted nothing at all — the user could be
 * three clicks deep into Client Profiles with the whole sidebar dark. A
 * prefix match fixes that, but only for items that opt in: "/" is a prefix
 * of every route in the app, so the dashboard has to stay exact.
 *
 * The `/` boundary check matters too — without it, /clients would light up
 * for a hypothetical /clients-archive.
 */
export function isNavItemActive(pathname, item) {
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

const styles = {
  sidebar: {
    position: "fixed",
    inset: "0 auto 0 0",
    width: layout.sidebarWidth,
    height: "100vh",
    // Flat, not a gradient: this design language builds hierarchy from
    // surface colour and hairline borders, never from depth effects.
    background: brand.base,
    padding: "20px 15px 15px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflow: "hidden",
  },
  logoWrap: {
    marginBottom: "15px",
    padding: "2px 8px 8px",
  },
  logoImage: {
    display: "block",
    width: "190px",
    maxWidth: "100%",
    height: "auto",
    objectFit: "contain",
  },
  navLinks: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  link: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "9px 12px",
    borderRadius: radius.control,
    color: "rgba(252, 250, 241, 0.82)",
    textDecoration: "none",
    fontSize: text.small.fontSize,
    fontWeight: weight.regular,
    border: "none",
    boxSizing: "border-box",
    transition: "background 0.15s ease, color 0.15s ease",
  },
  activeLink: {
    background: "rgba(252, 250, 241, 0.14)",
    color: "#fcfaf1",
    fontWeight: weight.medium,
  },
};

function Sidebar() {
  const location = useLocation();
  const { currentUser, can } = useAuth();

  const navItems = NAV_ITEMS.filter((item) => {
    if (item.role && currentUser?.role !== item.role) return false;
    if (item.subsystem && !can(item.subsystem, item.action)) return false;
    return true;
  });

  return (
    <nav style={styles.sidebar} aria-label="Primary">
      <div style={styles.logoWrap}>
        <img src="/brand-logo.png" alt="Torres Pest Control" style={styles.logoImage} />
      </div>

      <div style={styles.navLinks}>
        {navItems.map((item) => {
          const isActive = isNavItemActive(location.pathname, item);

          return (
            <Link
              key={item.path}
              className="sidebar-nav-link"
              to={item.path}
              aria-current={isActive ? "page" : undefined}
              style={{ ...styles.link, ...(isActive ? styles.activeLink : null) }}
            >
              <item.Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default Sidebar;
