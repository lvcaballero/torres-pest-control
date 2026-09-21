// Primary navigation.
//
// Nav items are derived from the permission matrix rather than a hardcoded
// `role === "ADMIN"` check, so a link appears exactly when the route behind it
// is reachable. RoleBasedRoute does the actual enforcing — this only decides
// what to show.
//
// The rail is a SURFACE, not an accent. It used to be a 264px full-height slab
// of #7f1111, which made it the only saturated block in an app whose every
// other surface steps through parchment -> bone -> white. This design language
// builds hierarchy from surface temperature and 1px borders, and spends its
// one chromatic accent on the thing that has earned attention — here, the
// active item. Painting the whole rail in it left nothing for the active state
// to say, and buried the brand mark, whose artwork is dark red and blue on
// transparency and so had almost no contrast against maroon.

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
import { brand, layout, neutral, radius, surface, text, weight } from "../../styles/tokens";

/**
 * Navigation, grouped. Six ungrouped links read as one undifferentiated run;
 * the groups give the rail the same uppercase-eyebrow rhythm every page header
 * uses, and let a screen reader announce "Operations, list, 3 items".
 *
 * Item shape is unchanged — `subsystem` + `action` are still what decides
 * visibility, via can() below.
 */
const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      // The dashboard is the only exact match — "/" prefixes every other route.
      { label: "Dashboard", path: "/", exact: true, subsystem: null, Icon: Gauge },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Scheduling", path: "/scheduling", subsystem: SUBSYSTEMS.SCHEDULING, action: "view", Icon: CalendarDays },
      { label: "Client Profiles", path: "/clients", subsystem: SUBSYSTEMS.CLIENTS, action: "view", Icon: BriefcaseBusiness },
      { label: "Inventory", path: "/inventory", subsystem: SUBSYSTEMS.INVENTORY, action: "view", Icon: Package },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "User Accounts", path: "/users", subsystem: SUBSYSTEMS.USERS, action: "view", Icon: Users },
      { label: "Treatment Methods", path: "/treatment-methods", subsystem: SUBSYSTEMS.SETTINGS, action: "view", Icon: ListChecks },
    ],
  },
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

/** Turns "Administration" into the id its <ul> points at. */
export function groupHeadingId(label) {
  return `sidebar-group-${label.toLowerCase().replace(/\s+/g, "-")}`;
}

const styles = {
  sidebar: {
    position: "fixed",
    inset: "0 auto 0 0",
    width: layout.sidebarWidth,
    height: "100vh",
    // Bone warmed toward maroon: a band distinct from the page that carries a
    // trace of the brand without spending the accent on 264px of background.
    // Flat, not a gradient — this design language builds hierarchy from
    // surface colour and hairline borders, never from depth effects.
    background: surface.rail,
    // The rail and the parchment canvas beside it are deliberately close. THIS
    // hairline is what separates them; removing it collapses the two surfaces
    // into one indistinct field.
    borderRight: `1px solid ${neutral.loam}`,
    padding: "20px 12px 15px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  logoWrap: {
    margin: "0 3px 15px",
    padding: "2px 9px 15px",
    borderBottom: `1px solid ${neutral.loam}`,
  },
  logoImage: {
    display: "block",
    width: "190px",
    maxWidth: "100%",
    height: "auto",
    objectFit: "contain",
  },
  navGroups: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  groupLabel: {
    margin: "0 0 4px",
    // 3px marker + 12px padding, so the eyebrow sits on the same left edge as
    // the link labels beneath it.
    padding: "0 15px",
    fontSize: text.caption.fontSize,
    lineHeight: text.caption.lineHeight,
    letterSpacing: text.eyebrow.letterSpacing,
    textTransform: "uppercase",
    fontWeight: weight.medium,
    // Bark (#96897b) is the usual muted tone, but it lands near 2.7:1 on bone
    // — too low for 11px text. Saddle is ~7:1 on this surface.
    color: neutral.saddle,
  },
  groupList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
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
    color: neutral.saddle,
    textDecoration: "none",
    fontSize: text.small.fontSize,
    fontWeight: weight.regular,
    // Every item carries the marker so the active one costs no layout shift.
    // A border, not an inset box-shadow: the no-shadow rule is absolute here.
    borderLeft: "3px solid transparent",
    boxSizing: "border-box",
    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
  },
  activeLink: {
    background: brand.wash,
    borderLeftColor: brand.base,
    color: neutral.ink,
    fontWeight: weight.medium,
  },
};

function Sidebar() {
  const location = useLocation();
  const { currentUser, can } = useAuth();

  const isVisible = (item) => {
    if (item.role && currentUser?.role !== item.role) return false;
    if (item.subsystem && !can(item.subsystem, item.action)) return false;
    return true;
  };

  // Filter first, then drop any group left empty — a technician must not see
  // an "Administration" heading floating above nothing.
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(isVisible),
  })).filter((group) => group.items.length > 0);

  return (
    <nav style={styles.sidebar} aria-label="Primary">
      <div style={styles.logoWrap}>
        <img src="/brand-logo.png" alt="Torres Pest Control" style={styles.logoImage} />
      </div>

      <div style={styles.navGroups}>
        {navGroups.map((group) => {
          const headingId = groupHeadingId(group.label);

          return (
            <div key={group.label}>
              <p id={headingId} style={styles.groupLabel}>
                {group.label}
              </p>

              <ul aria-labelledby={headingId} style={styles.groupList}>
                {group.items.map((item) => {
                  const isActive = isNavItemActive(location.pathname, item);

                  return (
                    <li key={item.path}>
                      <Link
                        className="sidebar-nav-link"
                        to={item.path}
                        aria-current={isActive ? "page" : undefined}
                        style={{ ...styles.link, ...(isActive ? styles.activeLink : null) }}
                      >
                        <item.Icon
                          size={16}
                          strokeWidth={1.75}
                          style={{ color: isActive ? brand.base : neutral.saddle, flexShrink: 0 }}
                          aria-hidden="true"
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default Sidebar;
