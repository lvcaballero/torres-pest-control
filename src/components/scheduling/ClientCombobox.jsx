// Searchable client picker.
//
// Kept as a combobox rather than a <select> because the office searches by
// phone and address as often as by name.
//
// The important behaviour is that typing clears the current pick: the box can
// never show one client's name while a different id is submitted. That guard
// predates this extraction and is preserved exactly.

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { neutral, radius, status, surface, text, weight } from "../../styles/tokens";
import Input from "../ui/Input";

function ClientCombobox({ clients, value, onChange, initialSearch = "", id = "client-search" }) {
  const [search, setSearch] = useState(initialSearch);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = clients.find((client) => client.id === value) || null;

  const matching = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.phone, client.email, client.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [clients, search]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const choose = (client) => {
    onChange(client.id, client);
    setSearch(client.name);
    setOpen(false);
  };

  const clear = () => {
    onChange("", null);
    setSearch("");
    setOpen(true);
    rootRef.current?.querySelector("input")?.focus();
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "grid", gap: "6px" }}>
      <input type="hidden" name="clientId" value={value} />

      <div style={{ position: "relative" }}>
        <Input
          id={id}
          value={search}
          onChange={(event) => {
            // Typing invalidates the current pick, so the box can never show
            // one client's name while a different id is submitted.
            setSearch(event.target.value);
            onChange("", null);
            setOpen(true);
          }}
          onFocus={(event) => {
            setOpen(true);
            if (selected) event.target.select();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Otherwise this would close the whole dialog.
              event.stopPropagation();
              setOpen(false);
            }
          }}
          placeholder="Search by name, phone, email, or address"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          style={{
            paddingRight: selected ? "32px" : undefined,
            borderColor: selected ? status.success : undefined,
          }}
        />

        {selected && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear selected client ${selected.name}`}
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              border: 0,
              background: "transparent",
              color: neutral.bark,
              cursor: "pointer",
              display: "inline-flex",
              padding: 0,
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 5,
            marginTop: "4px",
            maxHeight: "11rem",
            overflowY: "auto",
            background: surface.panel,
            border: `1px solid ${neutral.loam}`,
            borderRadius: radius.card,
          }}
        >
          {matching.length === 0 ? (
            <div style={{ padding: "10px 12px", color: neutral.bark, fontSize: text.small.fontSize }}>
              No clients match that search.
            </div>
          ) : (
            matching.map((client) => (
              <button
                type="button"
                key={client.id}
                role="option"
                aria-selected={client.id === value}
                onClick={() => choose(client)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: 0,
                  borderBottom: `1px solid ${surface.sunken}`,
                  background: client.id === value ? surface.sunken : "transparent",
                  padding: "8px 12px",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <span style={{ display: "block", color: neutral.ink, fontWeight: weight.medium, fontSize: text.small.fontSize }}>
                  {client.name}
                </span>
                {client.address && (
                  <span style={{ display: "block", color: neutral.bark, fontSize: text.caption.fontSize }}>
                    {client.address}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ClientCombobox;
