// The top bar: a sticky 56px band across the content column.
//
// Left to right: the drawer button (narrow screens only), the global search,
// then today's date, the notifications bell and — for anyone who can book —
// the single filled "New visit" action. The profile menu lives at the foot of
// the sidebar now, so this bar holds nothing about the user.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Plus } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { useNotifications } from "../../context/NotificationsContext";
import { SUBSYSTEMS } from "../../utils/permissions";
import { neutral } from "../../styles/tokens";
import Button from "../ui/Button";
import GlobalSearch from "./GlobalSearch";
import NotificationMenu from "./NotificationMenu";

/** Local calendar date as YYYY-MM-DD. Not toISOString(), which shifts to UTC. */
export function localDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Navbar({ onOpenMenu, menuOpen = false, menuButtonRef, search = <GlobalSearch /> }) {
  const { currentUser, can } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const bellRef = useRef(null);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    if (!bellOpen) return undefined;
    const handlePointerDown = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) setBellOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setBellOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [bellOpen]);

  if (!currentUser) return null;

  const today = new Date();
  const dateline = today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const canBook = typeof can === "function" && can(SUBSYSTEMS.SCHEDULING, "create");

  const toggleBell = () => {
    setBellOpen((current) => {
      const next = !current;
      if (next && unreadCount > 0) markAllRead();
      return next;
    });
  };

  const openNotification = (notification) => {
    setBellOpen(false);
    if (notification.appointmentId) navigate(`/scheduling?appointment=${notification.appointmentId}`);
  };

  return (
    <header className="app-topbar">
      {onOpenMenu && (
        <Button
          ref={menuButtonRef}
          size="icon"
          variant="quiet"
          className="app-menu-button"
          aria-label="Open navigation"
          aria-controls="app-rail"
          aria-expanded={menuOpen}
          onClick={onOpenMenu}
        >
          <Menu size={18} strokeWidth={1.6} />
        </Button>
      )}

      {search}

      <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
        <time className="app-topbar-date" dateTime={localDateValue(today)} style={{ color: neutral.bark, fontSize: "12.5px", whiteSpace: "nowrap" }}>
          {dateline}
        </time>

        <span ref={bellRef} style={{ display: "inline-flex" }}>
          <NotificationMenu
            notifications={notifications}
            unreadCount={unreadCount}
            open={bellOpen}
            onToggle={toggleBell}
            onOpenNotification={openNotification}
          />
        </span>

        {canBook && (
          <Button
            variant="primary"
            size="md"
            aria-label="New visit"
            icon={<Plus size={16} strokeWidth={1.8} />}
            onClick={() => navigate("/scheduling?new=1")}
          >
            <span className="app-topbar-label">New visit</span>
          </Button>
        )}
      </div>
    </header>
  );
}

export default Navbar;
