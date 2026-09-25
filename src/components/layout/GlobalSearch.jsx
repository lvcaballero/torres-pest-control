// The top bar's search box: clients, visits, items and accounts in one
// place, reachable from anywhere with Ctrl K (⌘K on a Mac).
//
// Matching lives in utils/globalSearch.js. This component owns the combobox
// behaviour: arrow keys move through the flattened result list, Enter opens
// the highlighted one, Escape closes. Lists the user may not open are passed
// as null so they are never searched, let alone shown.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import useClients from "../../hooks/useClients";
import useInventory from "../../hooks/useInventory";
import useUsers from "../../hooks/useUsers";
import { useScheduling } from "../../context/SchedulingContext";
import { ROLES } from "../../utils/constants";
import { SUBSYSTEMS } from "../../utils/permissions";
import { isAssignedTo } from "../../utils/scheduling";
import { searchEverything } from "../../utils/globalSearch";
import { neutral, radius, shadow, surface, weight } from "../../styles/tokens";
import { colors } from "../../styles/theme";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

export function GlobalSearchBox({ sources, placeholder = "Search clients, visits, items, CL-/TEC- numbers" }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const groups = useMemo(() => searchEverything(query, sources), [query, sources]);
  const flat = useMemo(() => groups.flatMap((group) => group.results.map((result) => ({ ...result, group: group.key }))), [groups]);

  // Ctrl K / ⌘K from anywhere focuses the box.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const go = (result) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    navigate(result.to);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
    } else if (event.key === "Enter") {
      // Layout swallows Enter outside textareas; stop it here first so the
      // highlighted result opens.
      event.preventDefault();
      event.stopPropagation();
      if (flat[active]) go(flat[active]);
    } else if (event.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
      setOpen(false);
    }
  };

  const showPanel = open && query.trim().length > 0;
  const optionId = (index) => `${listId}-option-${index}`;
  let running = -1;

  return (
    <div ref={wrapRef} className="global-search" style={{ position: "relative", flex: 1, maxWidth: "460px", minWidth: 0 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "36px",
          border: `1px solid ${neutral.loam}`,
          borderRadius: radius.control,
          background: surface.panel,
          padding: "0 10px",
          color: neutral.bark,
        }}
      >
        <Search size={16} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && flat[active] ? optionId(active) : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: "none",
            background: "transparent",
            color: neutral.ink,
            fontSize: "13.5px",
            boxShadow: shadow.none,
          }}
        />
        <kbd
          className="global-search-kbd"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            fontFamily: "inherit",
            border: `1px solid ${colors.line}`,
            borderRadius: "3px",
            padding: "0 5px",
            color: neutral.bark,
            background: surface.canvas,
            whiteSpace: "nowrap",
          }}
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </label>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 60,
            background: surface.panel,
            border: `1px solid ${neutral.loam}`,
            borderRadius: radius.card,
            padding: "6px",
            maxHeight: "min(70vh, 480px)",
            overflowY: "auto",
          }}
        >
          {groups.length === 0 ? (
            <p style={{ margin: 0, padding: "10px", color: neutral.bark, fontSize: "13px" }}>
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.key} role="group" aria-label={group.label}>
                <p
                  style={{
                    margin: 0,
                    padding: "8px 10px 4px",
                    fontSize: "10.5px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: neutral.bark,
                    fontWeight: weight.medium,
                  }}
                >
                  {group.label}
                </p>
                {group.results.map((result) => {
                  running += 1;
                  const index = running;
                  const isActive = index === active;
                  return (
                    <div
                      key={`${group.key}-${result.id}`}
                      id={optionId(index)}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => go(result)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: radius.control,
                        cursor: "pointer",
                        background: isActive ? colors.brandWash : "transparent",
                      }}
                    >
                      <div style={{ color: neutral.ink, fontSize: "13.5px", fontWeight: weight.medium }}>{result.label}</div>
                      {result.detail && <div style={{ color: neutral.bark, fontSize: "12px" }}>{result.detail}</div>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Wires the box to the loaded data, trimmed to what this user may open. */
function GlobalSearch() {
  const { currentUser, can } = useAuth();
  const { clients } = useClients();
  const { inventory } = useInventory();
  const { users } = useUsers();
  const { appointments } = useScheduling();

  const isTechnician = currentUser?.role === ROLES.TECHNICIAN;

  const sources = useMemo(
    () => ({
      clients: can(SUBSYSTEMS.CLIENTS, "view") ? clients : null,
      // A technician only opens their own visits, so only those are offered.
      appointments: can(SUBSYSTEMS.SCHEDULING, "view")
        ? isTechnician
          ? appointments.filter((appointment) => isAssignedTo(appointment, currentUser?.id))
          : appointments
        : null,
      inventory: can(SUBSYSTEMS.INVENTORY, "view") ? inventory : null,
      users: can(SUBSYSTEMS.USERS, "view") ? users : null,
    }),
    [can, clients, appointments, inventory, users, isTechnician, currentUser?.id]
  );

  return <GlobalSearchBox sources={sources} />;
}

export default GlobalSearch;
