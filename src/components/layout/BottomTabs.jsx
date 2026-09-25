// The technician's tab bar on a phone: Today, Schedule, Stock, Clients.
// Shown only below the drawer breakpoint (globals.css .bottom-tabs), and
// never during a visit, which has its own footer.

import { Link, useLocation } from "react-router-dom";
import { CalendarDays, Home, Package, Users } from "lucide-react";
import { isNavItemActive } from "./Sidebar";

const TABS = [
  { label: "Today", path: "/", exact: true, Icon: Home },
  { label: "Schedule", path: "/scheduling", Icon: CalendarDays },
  { label: "Stock", path: "/inventory", Icon: Package },
  { label: "Clients", path: "/clients", Icon: Users },
];

function BottomTabs() {
  const { pathname } = useLocation();
  return (
    <nav className="bottom-tabs" aria-label="Sections">
      {TABS.map((tab) => {
        const active = isNavItemActive(pathname, tab);
        return (
          <Link key={tab.path} to={tab.path} aria-current={active ? "page" : undefined} className={active ? "on" : undefined}>
            <tab.Icon size={22} strokeWidth={1.6} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomTabs;
