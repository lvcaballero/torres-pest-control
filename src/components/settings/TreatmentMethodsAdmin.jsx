// Admin panel for managing treatment method choices.
//
// Uses the same inline-style system (card, colors, inputStyle, primaryButton,
// secondaryButton, etc.) as every other page so the look is consistent.

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import ConfirmDialog from "../common/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { fetchAllTreatmentMethods, addTreatmentMethod, updateTreatmentMethod, deleteTreatmentMethod, setTreatmentMethodActive } from "../../services/settingsService";
import { card, colors, inputStyle, primaryButton, secondaryButton, dangerButton } from "../../styles/theme";

const GROUP_OPTIONS = ["Application", "Other work"];

// ── small inline modal ──────────────────────────────────────────────────────
function MethodModal({ open, initial, onSave, onCancel, busy }) {
  const [groupName, setGroupName] = useState(initial?.group_name || GROUP_OPTIONS[0]);
  const [value, setValue] = useState(initial?.value || "");
  const [label, setLabel] = useState(initial?.label || "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setGroupName(initial?.group_name || GROUP_OPTIONS[0]);
      setValue(initial?.value || "");
      setLabel(initial?.label || "");
      setSortOrder(initial?.sort_order ?? 0);
    }
  }, [open, initial]);

  // Auto-generate the value key from the label when creating.
  const handleLabelChange = (newLabel) => {
    setLabel(newLabel);
    if (!isEdit) {
      setValue(newLabel.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        zIndex: 1100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "20px",
          padding: "1.75rem",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 30px 60px rgba(15, 23, 42, 0.25)",
        }}
      >
        <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.25rem", color: colors.ink }}>
          {isEdit ? "Edit Treatment Method" : "Add Treatment Method"}
        </h2>

        <div style={{ display: "grid", gap: "1rem" }}>
          {/* Group */}
          <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem", fontWeight: 700, color: colors.body }}>
            Group
            <select
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {GROUP_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          {/* Label */}
          <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem", fontWeight: 700, color: colors.body }}>
            Display Label
            <input
              type="text"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g. Gel bait application"
              style={inputStyle}
            />
          </label>

          {/* Value (key) */}
          <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem", fontWeight: 700, color: colors.body }}>
            Internal Value
            <span style={{ fontWeight: 400, color: colors.muted, fontSize: "0.72rem" }}>
              Stored in the database. Auto-generated from the label.
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="e.g. GEL_BAIT"
              style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.88rem" }}
            />
          </label>

          {/* Sort Order */}
          <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem", fontWeight: 700, color: colors.body }}>
            Sort Order
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              style={{ ...inputStyle, maxWidth: "120px" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy || !label.trim() || !value.trim()}
            onClick={() => onSave({ groupName, value: value.trim(), label: label.trim(), sortOrder })}
            style={{ ...primaryButton, opacity: busy || !label.trim() || !value.trim() ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}
          >
            {busy ? "Saving…" : isEdit ? "Save Changes" : "Add Method"}
          </button>
          <button type="button" onClick={onCancel} style={secondaryButton}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main admin panel ────────────────────────────────────────────────────────
export default function TreatmentMethodsAdmin() {
  const { showSuccess, showError } = useToast();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add, object = edit

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAllTreatmentMethods();
    if (result.error) {
      showError(result.error);
    } else {
      setMethods(result.methods || []);
    }
    setLoading(false);
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  // ── handlers ────────────────────────────────────────────────────────────
  const openAdd = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (method) => { setEditTarget(method); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async (fields) => {
    setBusy(true);
    if (editTarget?.id) {
      const result = await updateTreatmentMethod(editTarget.id, fields);
      if (result.error) { showError(result.error); } else { showSuccess("Treatment method updated."); }
    } else {
      const result = await addTreatmentMethod(fields);
      if (result.error) { showError(result.error); } else { showSuccess("Treatment method added."); }
    }
    setBusy(false);
    closeModal();
    load();
  };

  // A method already recorded on a filed report cannot be deleted — doing so
  // would change what that report says. The database refuses it; here we turn
  // the refusal into the action the admin actually wants, which is to retire it.
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteTreatmentMethod(deleteTarget.id);
    if (result.inUse) {
      const retired = await setTreatmentMethodActive(deleteTarget.id, false);
      if (retired.error) {
        showError(retired.error);
      } else {
        showSuccess("This method is used on filed reports, so it was retired instead of deleted. Those reports keep their label.");
      }
    } else if (result.error) {
      showError(result.error);
    } else {
      showSuccess("Treatment method deleted.");
    }
    setBusy(false);
    setDeleteTarget(null);
    load();
  };

  const handleToggleActive = async (method) => {
    setBusy(true);
    const result = await setTreatmentMethodActive(method.id, !method.is_active);
    if (result.error) { showError(result.error); } else {
      showSuccess(method.is_active ? "Method retired. It no longer appears on the report form." : "Method restored.");
    }
    setBusy(false);
    load();
  };

  // ── grouped rendering ─────────────────────────────────────────────────
  const grouped = GROUP_OPTIONS.map((g) => ({
    name: g,
    items: methods.filter((m) => m.group_name === g),
  }));

  return (
    <section style={{ ...card, padding: "1.5rem" }}>
      {/* heading row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: colors.ink }}>Treatment Methods</h2>
          <p style={{ margin: "0.25rem 0 0", color: colors.muted, fontSize: "0.82rem" }}>
            Manage the choices technicians see under "Treatment performed" in service reports.
          </p>
        </div>
        <button type="button" onClick={openAdd} style={{ ...primaryButton, display: "inline-flex", alignItems: "center", gap: "0.45rem", fontSize: "0.88rem", padding: "0.65rem 1rem" }}>
          <Plus size={16} /> Add Method
        </button>
      </div>

      {loading && <div style={{ padding: "1.5rem", textAlign: "center", color: colors.muted }}>Loading…</div>}

      {!loading && grouped.map(({ name, items }) => (
        <div key={name} style={{ marginBottom: "1.25rem" }}>
          {/* group heading */}
          <div style={{ color: colors.muted, fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", borderBottom: `1px solid ${colors.softLine}`, paddingBottom: "0.35rem", marginBottom: "0.45rem" }}>
            {name}
          </div>

          {items.length === 0 && (
            <div style={{ padding: "0.6rem 0", color: colors.muted, fontSize: "0.85rem", fontStyle: "italic" }}>
              No methods in this group yet.
            </div>
          )}

          {items.map((method) => (
            <div
              key={method.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "10px",
                marginBottom: "0.3rem",
                background: method.is_active ? "transparent" : "#fafafa",
                border: "1px solid transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.border = "1px solid rgba(127,17,17,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = method.is_active ? "transparent" : "#fafafa"; e.currentTarget.style.border = "1px solid transparent"; }}
            >
              {/* label */}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: method.is_active ? colors.body : colors.muted }}>
                  {method.label}
                </span>
                <span style={{ marginLeft: "0.6rem", fontFamily: "monospace", fontSize: "0.72rem", color: colors.muted }}>
                  {method.value}
                </span>
                {!method.is_active && (
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", borderRadius: "999px", padding: "0.15rem 0.5rem" }}>
                    Inactive
                  </span>
                )}
              </div>

              {/* actions */}
              <button
                type="button"
                onClick={() => openEdit(method)}
                title="Edit"
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.brandInk, padding: "0.3rem", borderRadius: "6px" }}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleToggleActive(method)}
                disabled={busy}
                title={method.is_active ? "Retire (hide from the report form)" : "Restore"}
                style={{ background: "none", border: "none", cursor: busy ? "not-allowed" : "pointer", color: colors.muted, padding: "0.3rem", borderRadius: "6px" }}
              >
                {method.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(method)}
                title="Delete"
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, padding: "0.3rem", borderRadius: "6px" }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ))}

      {/* add / edit modal */}
      <MethodModal
        open={modalOpen}
        initial={editTarget}
        busy={busy}
        onSave={handleSave}
        onCancel={closeModal}
      />

      {/* delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Treatment Method"
        message={`Are you sure you want to permanently delete "${deleteTarget?.label}"? Existing reports that used this method will keep their data, but the checkbox will no longer appear for new reports.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

