// The bell and its dropdown.

import { Bell } from "lucide-react";
import { neutral, radius, status, surface, text, weight } from "../../styles/tokens";
import { formatDateTime } from "../../utils/formatters";
import Button from "../ui/Button";

const panelStyle = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: "20rem",
  maxHeight: "22rem",
  overflowY: "auto",
  background: surface.panel,
  borderRadius: radius.card,
  border: `1px solid ${neutral.loam}`,
  padding: "8px",
  zIndex: 50,
};

function NotificationMenu({ notifications, unreadCount, open, onToggle, onOpenNotification }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <Button
        size="icon"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        style={{ position: "relative", borderRadius: radius.pill, padding: "8px" }}
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "16px",
              height: "16px",
              padding: "0 4px",
              borderRadius: radius.pill,
              background: status.danger,
              color: surface.canvas,
              fontSize: "10px",
              fontWeight: weight.medium,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div role="menu" style={panelStyle}>
          <div
            style={{
              padding: "4px 6px 8px",
              borderBottom: `1px solid ${surface.sunken}`,
              fontWeight: weight.medium,
              fontSize: text.small.fontSize,
              color: neutral.ink,
            }}
          >
            Notifications
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: "15px 6px", color: neutral.bark, fontSize: text.small.fontSize }}>
              Nothing yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "4px", marginTop: "8px" }}>
              {notifications.map((notification) => (
                <button
                  type="button"
                  role="menuitem"
                  key={notification.id}
                  onClick={() => onOpenNotification(notification)}
                  className="ui-interactive"
                  style={{
                    display: "grid",
                    gap: "2px",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 9px",
                    borderRadius: radius.control,
                    border: `1px solid ${surface.sunken}`,
                    // Unread sits one surface step warmer than read.
                    background: notification.readAt ? surface.panel : surface.sunken,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ color: neutral.ink, fontSize: text.small.fontSize }}>
                    {notification.message}
                  </span>
                  <span style={{ color: neutral.bark, fontSize: text.caption.fontSize }}>
                    {formatDateTime(notification.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationMenu;
