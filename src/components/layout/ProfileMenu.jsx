// The signed-in user's chip and its dropdown.

import { ChevronDown, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { neutral, radius, surface, text, weight } from "../../styles/tokens";
import StatusPill from "../ui/StatusPill";
import Avatar from "./Avatar";
import { humanizeEnum } from "../../utils/formatters";

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

/** The rail footer's trigger: avatar, name and role in a full-width row. */
function RailTrigger({ user, displayName, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="menu"
      className="ui-interactive"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "4px 6px",
        border: "1px solid transparent",
        borderRadius: radius.control,
        background: "transparent",
        color: neutral.ink,
        textAlign: "left",
      }}
    >
      <Avatar user={user} size={30} />
      <span style={{ lineHeight: 1.25, minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: weight.medium,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayName}
        </span>
        <span style={{ display: "block", fontSize: "11.5px", color: neutral.bark }}>{humanizeEnum(user.role)}</span>
      </span>
      <ChevronDown
        size={14}
        style={{ color: neutral.bark, flexShrink: 0, transform: open ? "rotate(180deg)" : undefined }}
        aria-hidden="true"
      />
    </button>
  );
}

function ProfileMenu({ user, open, onToggle, onNavigate, onLogout, variant = "chip" }) {
  const displayName = user.name || user.username || "User";
  const isRail = variant === "rail";

  return (
    <div style={{ position: "relative", display: isRail ? "block" : "inline-flex", alignItems: "center" }}>
      {isRail ? (
        <RailTrigger user={user} displayName={displayName} open={open} onToggle={onToggle} />
      ) : (
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
      )}

      {open && (
        <div
          role="menu"
          style={isRail ? { ...panelStyle, top: "auto", bottom: "calc(100% + 8px)", left: 0, right: "auto", width: "100%", minWidth: "200px" } : panelStyle}
        >
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
