// The signed-in user's picture, or their initials.
//
// Navbar rendered two near-identical copies of this block — one in the
// trigger, one inside the open menu — differing only in size.

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

function Avatar({ user, size = 34 }) {
  const label = user?.name || user?.username || "User profile";

  return (
    <span
      style={{
        display: "inline-flex",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius.pill,
        overflow: "hidden",
        border: `1px solid ${neutral.loam}`,
        background: surface.sunken,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            color: neutral.saddle,
            fontSize: `${Math.round(size * 0.36)}px`,
            fontWeight: weight.medium,
          }}
        >
          {initialsFor(user)}
        </span>
      )}
    </span>
  );
}

export default Avatar;
