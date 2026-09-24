// A person as initials in a circle — how technicians are told apart
// everywhere (calendar, filters, crew lists) now that they have no colour.
// A colour assigned by list position repainted everyone whenever an account
// was added or deactivated; initials don't move.

import { neutral, radius, surface, weight } from "../../styles/tokens";

/** Up to two initials from a display name, e.g. "Karl Hameed" -> "KH". */
export function initialsFor(user) {
  return (user?.name || user?.username || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const SIZES = { xs: 18, sm: 22, md: 30, lg: 34 };

function Avatar({ user, size = "md", title, style }) {
  const px = typeof size === "number" ? size : SIZES[size] || SIZES.md;
  const label = user?.name || user?.username || "User profile";
  const unknown = !user;

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        width: `${px}px`,
        height: `${px}px`,
        borderRadius: radius.pill,
        overflow: "hidden",
        border: `1px ${unknown ? "dashed" : "solid"} ${neutral.loam}`,
        background: surface.panel,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <span
          aria-hidden="true"
          style={{
            color: neutral.saddle,
            fontSize: `${Math.max(8, Math.round(px * 0.36))}px`,
            fontWeight: 600,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          {unknown ? "?" : initialsFor(user)}
        </span>
      )}
    </span>
  );
}

/**
 * A crew as overlapping initials. `users` may include nulls for ids that no
 * longer resolve to an account; those are skipped.
 */
export function AvatarStack({ users, size = "sm", max = 3 }) {
  const people = users.filter(Boolean);
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const names = people.map((user) => user.name || user.username).join(", ");

  return (
    <span aria-label={names} title={names} style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((user, index) => (
        <Avatar key={user.id || index} user={user} size={size} style={{ marginLeft: index ? "-5px" : 0 }} />
      ))}
      {extra > 0 && (
        <span style={{ marginLeft: "4px", fontSize: "11px", color: neutral.bark, fontWeight: weight.medium }}>+{extra}</span>
      )}
    </span>
  );
}

export default Avatar;
