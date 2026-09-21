// Slim top bar above the page content.
//
// Shows who is signed in and gives the profile/settings shortcuts a home that
// isn't the sidebar. Kept deliberately light — the sidebar is still primary
// navigation.
//
// The two dropdowns live in NotificationMenu and ProfileMenu; this only owns
// which of them is open and the outside-click that closes both.
//
// The left slot holds a dateline rather than the page name: every page already
// opens with a PageHeader carrying its own eyebrow + title, so a title here
// would print the same words twice, 24px apart. A dateline is the same rhythm
// device — the reference describes the eyebrow as having "the cadence of a
// newspaper dateline" — and in a scheduling business today's date is worth
// keeping permanently on screen.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { useNotifications } from "../../context/NotificationsContext";
import { surface } from "../../styles/tokens";
import { eyebrow } from "../../styles/theme";
import NotificationMenu from "./NotificationMenu";
import ProfileMenu from "./ProfileMenu";

function Navbar() {
  const { currentUser, logout: logoutUser } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null); // "bell" | "profile" | null

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpenMenu(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Escape closes whichever menu is open, which neither of them did before.
  useEffect(() => {
    if (!openMenu) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openMenu]);

  if (!currentUser) return null;

  const today = new Date();
  const dateline = today
    .toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
  // Local calendar date, not toISOString() — that converts to UTC first and
  // would read as yesterday for anyone west of Greenwich after 4pm.
  const datelineValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const toggleBell = () => {
    setOpenMenu((current) => {
      const next = current === "bell" ? null : "bell";
      if (next === "bell" && unreadCount > 0) markAllRead();
      return next;
    });
  };

  const handleNavigate = (path) => {
    setOpenMenu(null);
    navigate(path);
  };

  const handleLogout = async () => {
    setOpenMenu(null);
    try {
      await logoutUser();
    } finally {
      navigate("/login");
    }
  };

  const openNotification = (notification) => {
    setOpenMenu(null);
    if (notification.appointmentId) navigate("/scheduling");
  };

  return (
    <header
      ref={menuRef}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px",
        padding: "0 0 15px",
        borderBottom: `1px solid ${surface.sunken}`,
        marginBottom: "24px",
        flexWrap: "wrap",
        position: "relative",
      }}
    >
      <time dateTime={datelineValue} style={{ ...eyebrow, whiteSpace: "nowrap" }}>
        {dateline}
      </time>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <NotificationMenu
          notifications={notifications}
          unreadCount={unreadCount}
          open={openMenu === "bell"}
          onToggle={toggleBell}
          onOpenNotification={openNotification}
        />

        <ProfileMenu
          user={currentUser}
          open={openMenu === "profile"}
          onToggle={() => setOpenMenu((current) => (current === "profile" ? null : "profile"))}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
}

export default Navbar;
