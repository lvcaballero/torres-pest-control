// The technician filter.
//
// Replaces TWO controls that drove the same piece of state: a <select> in the
// toolbar and a row of colour-swatch pills under the calendar. They could
// disagree visually, they cost ~40px of vertical space between them, and the
// legend explaining the colours lived nowhere near the control that used
// them. Technicians are identified by initials now, as they are on the
// cards, so each option carries the same avatar the calendar shows.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { brand, neutral, radius, surface, text, weight } from "../../styles/tokens";
import Button from "../ui/Button";
import Avatar from "../ui/Avatar";

/** The value meaning "no filter". Unassigned-only is the empty string. */
export const ALL_TECHNICIANS = "ALL";
export const UNASSIGNED_ONLY = "";


function TechnicianFilter({
  technicians,
  value,
  onChange,
  countFor = () => null,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selected = technicians.find((account) => account.id === value);
  const label =
    value === ALL_TECHNICIANS
      ? "All technicians"
      : value === UNASSIGNED_ONLY
        ? "Unassigned only"
        : selected?.name || selected?.username || "Technician";

  const options = [
    { key: ALL_TECHNICIANS, label: "All technicians", person: undefined },
    ...technicians.map((account) => ({
      key: account.id,
      label: account.name || account.username,
      person: account,
      count: countFor(account.id),
    })),
    { key: UNASSIGNED_ONLY, label: "Unassigned", person: null, count: countFor(null) },
  ];

  const choose = (key) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <Button
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        icon={<Users size={14} strokeWidth={1.75} />}
        size="sm"
        style={{
          // An active filter is a state the user must be able to see at a
          // glance, or they will wonder where their appointments went.
          borderColor: value === ALL_TECHNICIANS ? undefined : brand.base,
          color: value === ALL_TECHNICIANS ? undefined : brand.base,
        }}
      >
        {label}
        <ChevronDown size={13} aria-hidden="true" />
      </Button>

      {open && (
        <div
          role="listbox"
          aria-label="Filter by technician"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
            minWidth: "230px",
            background: surface.panel,
            border: `1px solid ${neutral.loam}`,
            borderRadius: radius.card,
            padding: "4px",
          }}
        >
          {options.map((option) => {
            const isSelected = option.key === value;

            return (
              <button
                key={option.key || "unassigned"}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(option.key)}
                className="ui-interactive"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: isSelected ? surface.sunken : "transparent",
                  borderRadius: radius.control,
                  padding: "7px 9px",
                  cursor: "pointer",
                  color: neutral.ink,
                  fontSize: text.small.fontSize,
                  fontWeight: isSelected ? weight.medium : weight.regular,
                }}
              >
                {option.person === undefined ? (
                  <span style={{ width: "22px", flex: "none" }} />
                ) : (
                  <Avatar user={option.person} size="sm" />
                )}
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {option.label}
                </span>
                {option.count != null && (
                  <span style={{ color: neutral.bark, fontSize: "11px" }}>{option.count}</span>
                )}
                {isSelected && <Check size={13} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TechnicianFilter;
