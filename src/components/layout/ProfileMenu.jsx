// The signed-in user's chip and its dropdown.

import { ChevronDown, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { neutral, radius, surface, text, weight } from "../../styles/tokens";
import StatusPill from "../ui/StatusPill";
import Avatar from "./Avatar";

const panelStyle = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: "16rem",
  background: surface.panel,
  borderRadius: radius.card,
  border: `1px solid ${neutral.loam}`,
  padding: "8px",
  color: neutral.ink,
  zIndex: 50,
};

const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  width: "100%",
  padding: "9px 10px",
  borderRadius: radius.control,
  border: "1px solid transparent",
  background: "transparent",
  color: neutral.ink,
  cursor: "pointer",
  fontSize: text.small.fontSize,
  fontWeight: weight.regular,
  textAlign: "left",
};

function ProfileMenu({ user, open, onToggle, onNavigate, onLogout }) {
  const displayName = user.name || user.username || "User";

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ui-interactive"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "9px",
          padding: "4px 10px 4px 4px",
          borderRadius: radius.pill,
          border: `1px solid ${neutral.loam}`,
          background: surface.panel,
          cursor: "pointer",
          color: neutral.ink,
        }}
      >
        <Avatar user={user} size={30} />
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "2px",
            lineHeight: 1.1,
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: text.caption.fontSize, fontWeight: weight.medium, whiteSpace: "nowrap" }}>
            {displayName}
          </span>
          {/* StatusPill falls back to a neutral tone for a role it does not
              know. The palette this replaced was indexed unguarded, so an
              unrecognised role spread `undefined` into the style object. */}
          <StatusPill status={user.role} style={{ fontSize: "10px", padding: "1px 7px" }} />
        </span>
        <ChevronDown size={14} style={{ color: neutral.bark, flexShrink: 0 }} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" style={panelStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "6px 4px 12px",
              borderBottom: `1px solid ${surface.sunken}`,
            }}
          >
            <Avatar user={user} size={40} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: text.body.fontSize,
                  fontWeight: weight.medium,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </div>
              <StatusPill status={user.role} style={{ marginTop: "3px" }} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "2px", marginTop: "8px" }}>
            <button
              type="button"
              role="menuitem"
              className="ui-interactive"
              onClick={() => onNavigate("/account")}
              style={itemStyle}
            >
              <UserCog size={15} strokeWidth={1.75} aria-hidden="true" />
              Edit Profile
            </button>

            <button
              type="button"
              role="menuitem"
              className="ui-interactive"
              onClick={() => onNavigate("/account?tab=security")}
              style={itemStyle}
            >
              <ShieldCheck size={15} strokeWidth={1.75} aria-hidden="true" />
              Change Password
            </button>

            <button
              type="button"
              role="menuitem"
              className="ui-interactive"
              onClick={onLogout}
              style={itemStyle}
            >
              <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileMenu;
