// Slim top bar above the page content.
//
// Shows who is signed in and gives the profile/settings shortcuts a home that
// isn't the sidebar. Kept deliberately light — the sidebar is still primary
// navigation.
//
// The two dropdowns live in NotificationMenu and ProfileMenu; this only owns
// which of them is open and the outside-click that closes both.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { useNotifications } from "../../context/NotificationsContext";
import { surface } from "../../styles/tokens";
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
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "10px",
        padding: "0 0 15px",
        borderBottom: `1px solid ${surface.sunken}`,
        marginBottom: "24px",
        flexWrap: "wrap",
        position: "relative",
      }}
    >
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
    </header>
  );
}

export default Navbar;
