import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  GripVertical,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import ClientDocuments from "../components/clients/ClientDocuments";
import useAuth from "../hooks/useAuth";
import useClients from "../hooks/useClients";
import useInventory from "../hooks/useInventory";
import useUsers from "../hooks/useUsers";
import { useScheduling } from "../context/SchedulingContext";
import { ACCOUNT_STATUS, PEST_CONCERN_SUGGESTIONS } from "../utils/constants";
import { card, colors, inputStyle, pageShell, primaryButton, secondaryButton } from "../styles/theme";

const HOURS = Array.from({ length: 10 }, (_, index) => index + 8);
const STATUSES = ["Pending", "Scheduled", "Confirmed", "Reschedule", "Completed", "Cancelled"];
const TAB_LABELS = ["Overview", "Documents", "Report", "Stock-Out"];
const STOCK_CATEGORIES = ["CHEMICAL", "MATERIAL", "EQUIPMENT"];
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours ? `${hours} hour${hours === 1 ? "" : "s"}` : ""}${hours && remainingMinutes ? " and " : ""}${remainingMinutes ? `${remainingMinutes} minutes` : ""}`;
}

function readDuration(values) {
  const hours = Number(values.get("durationHours")) || 0;
  const minutes = Number(values.get("durationMinutes")) || 0;
  return hours * 60 + minutes;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatTime(value) {
  if (!value) return "";
  return new Date(`2000-01-01T${value}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toDateTimeLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function badgeStyle(status) {
  const map = {
    Pending: ["#fff7ed", "#c2410c"],
    Scheduled: ["#eff6ff", "#1d4ed8"],
    Confirmed: ["#ecfdf5", "#047857"],
    Completed: ["#f0fdf4", "#166534"],
    Cancelled: ["#fef2f2", "#b91c1c"],
  };
  const [background, color] = map[status] || map.Pending;
  return { background, color, borderRadius: 999, padding: "0.25rem 0.55rem", fontSize: "0.7rem", fontWeight: 800 };
}

function SchedulingPage() {
  const { can } = useAuth();
  const { clients, addDocument, removeDocument, getDocumentUrl } = useClients();
  const { inventory, stockOutMany } = useInventory();
  const { staff, technicians } = useUsers();
  const { appointments, createAppointment, updateAppointment, submitReport, addStockUsed, loading, error } = useScheduling();
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [tab, setTab] = useState("Overview");
  const [draggedId, setDraggedId] = useState(null);
  const [message, setMessage] = useState("");
  const [stockRows, setStockRows] = useState(STOCK_CATEGORIES.map((category) => ({ id: `stock-row-${category}`, category, itemId: "", amount: "" })));
  const [createOpen, setCreateOpen] = useState(false);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [showAvailability, setShowAvailability] = useState(false);

  const selected = appointments.find((appointment) => appointment.id === selectedId) || null;
  const selectedClient = clients.find((client) => client.id === selected?.clientId) || null;
  const activeAccounts = useMemo(
    () => [...staff, ...technicians].filter((account) => account.status !== ACCOUNT_STATUS.INACTIVE),
    [staff, technicians]
  );
  const weekStart = startOfWeek(anchorDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthCells = useMemo(() => {
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [anchorDate]);
  const visibleAppointments = useMemo(() => {
    const term = appointmentSearch.trim().toLowerCase();
    if (!term) return appointments;
    return appointments.filter((appointment) => {
      const client = clients.find((entry) => entry.id === appointment.clientId);
      const technician = activeAccounts.find((account) => account.id === appointment.technicianId);
      return `${client?.name || ""} ${client?.address || ""} ${appointment.status} ${technician?.name || technician?.username || ""}`.toLowerCase().includes(term);
    });
  }, [appointments, appointmentSearch, clients, activeAccounts]);

  const appointmentFor = (dateKey, hour) => appointments.filter((appointment) => {
    const date = new Date(appointment.scheduledAt);
    return localDateKey(date) === dateKey && date.getHours() === hour && visibleAppointments.some((entry) => entry.id === appointment.id);
  });

  const moveAppointment = async (dateKey, time = "09:00") => {
    if (!draggedId) return;
    const current = appointments.find((appointment) => appointment.id === draggedId);
    if (!current) {
      setDraggedId(null);
      return;
    }
    const nextScheduledAt = `${dateKey}T${time}:00`;
    if (current.status !== "Reschedule") {
      const prepareResult = await updateAppointment({ ...current, status: "Reschedule" });
      if (typeof prepareResult === "string") {
        setDraggedId(null);
        setMessage(prepareResult);
        return;
      }
    }
    const result = await updateAppointment({ ...current, scheduledAt: nextScheduledAt, status: "Confirmed" });
    setSelectedId(draggedId);
    setDraggedId(null);
    setMessage(typeof result === "string" ? result : `Moved appointment to ${formatDateTime(nextScheduledAt)}.`);
  };

  const navigateCalendar = (amount) => {
    const next = new Date(anchorDate);
    if (view === "week") next.setDate(next.getDate() + amount * 7);
    else next.setMonth(next.getMonth() + amount);
    setAnchorDate(next);
  };

  const handleManualSave = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextValue = form.get("scheduledAt");
    const result = await updateAppointment({
      ...selected,
      scheduledAt: new Date(nextValue).toISOString(),
      durationMinutes: readDuration(form),
      pestConcern: form.get("pestConcern"),
      technicianId: form.get("technicianId"),
      status: form.get("status"),
      notes: form.get("notes"),
    });
    setMessage(typeof result === "string" ? result : "Appointment details updated.");
  };

  const handleTimingSave = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await updateAppointment({
      ...selected,
      durationMinutes: readDuration(form),
      pestConcern: form.get("pestConcern"),
    });
    setMessage(typeof result === "string" ? result : "Appointment timing updated.");
  };

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    const report = new FormData(event.currentTarget).get("report").trim();
    if (!report) return;
    const result = await submitReport(selected.id, report);
    setMessage(typeof result === "string" ? result : "Report submitted and service marked Completed.");
  };

  const handleStockSubmit = async (event) => {
    event.preventDefault();
    const entries = stockRows.filter((row) => row.itemId).map((row) => ({ itemId: row.itemId, amount: Number(row.amount) }));
    if (entries.length === 0 || entries.some((entry) => !Number.isInteger(entry.amount) || entry.amount <= 0)) {
      setMessage("Select at least one item and enter a positive whole-number quantity.");
      return;
    }
    if (new Set(entries.map((entry) => entry.itemId)).size !== entries.length) {
      setMessage("Select each inventory item only once per stock-out.");
      return;
    }
    const result = await stockOutMany(selected.id, entries);
    if (typeof result === "string") {
      setMessage(result);
      return;
    }
    entries.forEach((entry) => {
      const item = inventory.find((candidate) => candidate.id === entry.itemId);
      addStockUsed(selected.id, { itemId: entry.itemId, name: item?.name || "Inventory item", amount: entry.amount, unit: item?.unit || "", date: new Date().toISOString().slice(0, 10) });
    });
    setStockRows(STOCK_CATEGORIES.map((category) => ({ id: `stock-row-${category}-${Date.now()}`, category, itemId: "", amount: "" })));
    setMessage(`${entries.length} stock item${entries.length === 1 ? "" : "s"} recorded as OUT for this appointment.`);
  };

  const handleCreate = async (fields) => {
    const result = await createAppointment(fields);
    if (typeof result === "string") return result;
    setCreateOpen(false);
    setSelectedId(result.id);
    setView("week");
    setAnchorDate(startOfWeek(new Date(result.scheduledAt)));
    setMessage("Appointment created.");
    return true;
  };

  const renderAppointmentCard = (appointment, compact = false) => {
    const client = clients.find((entry) => entry.id === appointment.clientId);
    if (!client) return null;
    const selectedCard = appointment.id === selectedId;
    return (
      <button
        key={appointment.id}
        type="button"
        draggable
        onDragStart={async () => {
          setDraggedId(appointment.id);
          if (appointment.status !== "Reschedule") {
            const result = await updateAppointment({ ...appointment, status: "Reschedule" });
            if (typeof result === "string") setMessage(result);
          }
        }}
        onDragEnd={() => setDraggedId(null)}
        onClick={() => { setSelectedId(appointment.id); setTab("Overview"); }}
        style={{
          width: "100%", textAlign: "left", cursor: "grab", border: selectedCard ? `2px solid ${colors.brandLight}` : "1px solid #e8d9d9",
          borderRadius: "10px", padding: compact ? "0.45rem" : "0.65rem", background: selectedCard ? "#fff6f6" : "#ffffff",
          boxShadow: selectedCard ? "0 6px 16px rgba(127,17,17,0.12)" : "0 2px 5px rgba(15,23,42,0.04)",
          minHeight: compact ? undefined : `${Math.max(56, ((appointment.durationMinutes || 60) / 60) * 76 - 10)}px`,
          position: "relative", zIndex: selectedCard ? 2 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: colors.brand, fontSize: "0.68rem", fontWeight: 800 }}>
          <GripVertical size={12} /> {new Date(appointment.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </div>
        <div style={{ color: colors.ink, fontWeight: 800, fontSize: compact ? "0.72rem" : "0.8rem", marginTop: "0.25rem" }}>{client.name}</div>
        {!compact && <div style={{ color: colors.muted, fontSize: "0.68rem", marginTop: "0.2rem" }}>{formatDuration(appointment.durationMinutes || 60)}</div>}
        {!compact && <div style={{ color: colors.muted, fontSize: "0.68rem", marginTop: "0.2rem" }}>{appointment.pestConcern || "Inspection"}</div>}
        <span style={{ ...badgeStyle(appointment.status), display: "inline-block", marginTop: "0.4rem", fontSize: "0.62rem" }}>{appointment.status}</span>
      </button>
    );
  };

  return (
    <div style={pageShell}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ color: colors.brand, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Operations</div>
          <h1 style={{ margin: "0.25rem 0 0", color: colors.ink, fontSize: "2rem" }}>Scheduling</h1>
          <p style={{ color: colors.muted, margin: "0.35rem 0 0" }}>Plan visits, coordinate technicians, and close the loop from field report to stock usage.</p>
        </div>
        <div style={{ display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap" }}><button type="button" style={secondaryButton} onClick={() => setShowAvailability((current) => !current)}>{showAvailability ? "Hide availability" : "Technician availability"}</button><button type="button" style={primaryButton} onClick={() => setCreateOpen(true)}><Plus size={16} /> New appointment</button></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "minmax(0, 1.25fr) minmax(360px, 0.75fr)" : "1fr", gap: "1.25rem", alignItems: "start" }}>
        <section style={card}>
          <div style={{ display: "flex", gap: "0.55rem", alignItems: "center", marginBottom: "1rem" }}><Search size={16} color={colors.muted} /><input value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} placeholder="Search appointments, clients, technicians, status" style={{ ...inputStyle, maxWidth: "420px" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <button type="button" aria-label="Previous period" onClick={() => navigateCalendar(-1)} style={secondaryButton}><ChevronLeft size={16} /></button>
              <button type="button" aria-label="Next period" onClick={() => navigateCalendar(1)} style={secondaryButton}><ChevronRight size={16} /></button>
              <strong style={{ color: colors.ink }}>{view === "week" ? `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} - ${addDays(weekStart, 6).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}` : anchorDate.toLocaleDateString([], { month: "long", year: "numeric" })}</strong>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", background: "#f8fafc", padding: "0.25rem", borderRadius: "10px" }}>
              {['week', 'month'].map((option) => <button key={option} type="button" onClick={() => setView(option)} style={{ ...secondaryButton, border: "none", background: view === option ? colors.brand : "transparent", color: view === option ? "#fff" : colors.body, padding: "0.55rem 0.8rem" }}>{option === "week" ? "Week" : "Month"}</button>)}
            </div>
          </div>

          {view === "week" ? (
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "780px", display: "grid", gridTemplateColumns: "64px repeat(7, minmax(95px, 1fr))", borderTop: "1px solid #eadede", borderLeft: "1px solid #eadede" }}>
                <div style={{ background: "#fffafa" }} />
                {weekDays.map((date) => <div key={localDateKey(date)} style={{ padding: "0.7rem 0.35rem", textAlign: "center", borderRight: "1px solid #eadede", borderBottom: "1px solid #eadede", background: localDateKey(date) === localDateKey(new Date()) ? "#fff1f1" : "#fffafa" }}><div style={{ color: colors.muted, fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase" }}>{date.toLocaleDateString([], { weekday: "short" })}</div><div style={{ color: colors.ink, fontSize: "1.05rem", fontWeight: 800 }}>{date.getDate()}</div></div>)}
                {HOURS.map((hour) => <div key={hour} style={{ display: "contents" }}><div style={{ color: colors.muted, fontSize: "0.65rem", padding: "0.55rem 0.3rem", textAlign: "right", borderRight: "1px solid #eadede", borderBottom: "1px solid #eadede" }}>{formatTime(`${String(hour).padStart(2, "0")}:00`)}</div>{weekDays.map((date) => { const key = localDateKey(date); return <div key={`${key}-${hour}`} onDragOver={(event) => event.preventDefault()} onDrop={() => moveAppointment(key, `${String(hour).padStart(2, "0")}:00`)} style={{ minHeight: "76px", padding: "0.3rem", borderRight: "1px solid #eadede", borderBottom: "1px solid #eadede", background: draggedId ? "#fffdfd" : "#fff" }}>{appointmentFor(key, hour).map((appointment) => renderAppointmentCard(appointment))}</div>; })}</div>)}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(90px, 1fr))", overflowX: "auto", minWidth: "680px", borderTop: "1px solid #eadede", borderLeft: "1px solid #eadede" }}>
              {monthCells.map((date) => { const key = localDateKey(date); const entries = visibleAppointments.filter((appointment) => localDateKey(new Date(appointment.scheduledAt)) === key); return <div key={key} onDragOver={(event) => event.preventDefault()} onDrop={() => moveAppointment(key)} style={{ minHeight: "112px", padding: "0.45rem", borderRight: "1px solid #eadede", borderBottom: "1px solid #eadede", background: date.getMonth() === anchorDate.getMonth() ? "#fff" : "#fafafa" }}><div style={{ color: date.getMonth() === anchorDate.getMonth() ? colors.ink : "#a3a3a3", fontWeight: 800, fontSize: "0.75rem", marginBottom: "0.3rem" }}>{date.getDate()}</div><div style={{ display: "grid", gap: "0.3rem" }}>{entries.map((appointment) => renderAppointmentCard(appointment, true))}</div></div>; })}
            </div>
          )}
          <div style={{ display: "flex", gap: "1rem", color: colors.muted, fontSize: "0.72rem", marginTop: "0.85rem", alignItems: "center" }}><GripVertical size={14} /> Drag any appointment to reschedule it. Dropping it saves the new time as Confirmed.</div>
          {loading && <div role="status" style={{ marginTop: "0.75rem", color: colors.muted, fontWeight: 700, fontSize: "0.82rem" }}>Loading appointments...</div>}
          {(message || error) && <div role="status" style={{ marginTop: "0.75rem", color: error ? colors.danger : colors.success, fontWeight: 700, fontSize: "0.82rem" }}>{error || message}</div>}
          {clients.length === 0 && <div style={{ padding: "2rem 1rem", textAlign: "center", color: colors.muted }}>Client profiles will appear here once they are loaded.</div>}
          {appointmentSearch && visibleAppointments.length === 0 && <div style={{ padding: "1rem", textAlign: "center", color: colors.muted }}>No appointments match this search.</div>}
          {showAvailability && <TechnicianAvailability accounts={activeAccounts} appointments={appointments} weekDays={weekDays} />}
        </section>

        {selected && selectedClient && <AppointmentPanel key={`${selected.id}-${selected.status}-${selected.updatedAt || ""}`} appointment={selected} client={selectedClient} tab={tab} setTab={setTab} activeAccounts={technicians} appointments={appointments} canUpload={can("clientDocuments", "create")} canRemove={can("clientDocuments", "delete")} addDocument={addDocument} removeDocument={removeDocument} getDocumentUrl={getDocumentUrl} onSave={handleManualSave} onTimingSave={handleTimingSave} onReportSubmit={handleReportSubmit} onStockSubmit={handleStockSubmit} inventory={inventory} stockRows={stockRows} setStockRows={setStockRows} onClose={() => setSelectedId(null)} />}
      </div>
      {createOpen && <CreateAppointmentModalV2 clients={clients} activeAccounts={technicians} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />}
    </div>
  );
}

function AppointmentOverviewForm({ appointment, client, activeAccounts, busyTechnicians, onSave }) {
  const hours = Math.floor((appointment.durationMinutes || 60) / 60);
  const minutes = (appointment.durationMinutes || 60) % 60;

  return <form onSubmit={onSave} style={{ display: "grid", gap: "1rem" }}>
    <InfoRow icon={<UserRound size={15} />} label="Client contact" value={`${client.phone || "No phone"} ${client.email ? `• ${client.email}` : ""}`} />
    <InfoRow icon={<MapPin size={15} />} label="Service address" value={client.address || "No address"} />
    <InfoRow icon={<UserRound size={15} />} label="Classification" value={client.classificationOther || client.classification || "Not classified"} />
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Date and time</strong><input name="scheduledAt" type="datetime-local" defaultValue={toDateTimeLocal(appointment.scheduledAt)} style={inputStyle} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontSize: "0.72rem", fontWeight: 700 }}>Hours<input name="durationHours" type="number" min="0" max="24" defaultValue={hours} style={{ ...inputStyle, padding: "0.55rem" }} required /></label><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontSize: "0.72rem", fontWeight: 700 }}>Minutes<input name="durationMinutes" type="number" min="0" max="59" defaultValue={minutes} style={{ ...inputStyle, padding: "0.55rem" }} required /></label></div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Technician</strong><select name="technicianId" defaultValue={appointment.technicianId} style={inputStyle}><option value="">Unassigned</option>{activeAccounts.map((account) => <option key={account.id} value={account.id} disabled={busyTechnicians.has(account.id)}>{account.name || account.username}{busyTechnicians.has(account.id) ? " - busy at this time" : ""}</option>)}</select></div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Pest concern</strong><select name="pestConcern" defaultValue={appointment.pestConcern || ""} style={inputStyle}><option value="">Select a pest concern</option>{PEST_CONCERN_SUGGESTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Status</strong><select name="status" defaultValue={appointment.status} style={inputStyle}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Visit notes</strong><textarea name="notes" defaultValue={appointment.notes} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></div>
    <button type="submit" style={primaryButton}><Check size={15} /> Save appointment</button>
  </form>;
}

function AppointmentPanel({ appointment, client, tab, setTab, activeAccounts, appointments, canUpload, canRemove, addDocument, removeDocument, getDocumentUrl, onSave, onTimingSave, onReportSubmit, onStockSubmit, inventory, stockRows, setStockRows, onClose }) {
  const busyTechnicians = new Set(appointments.filter((entry) => entry.id !== appointment.id && entry.technicianId && entry.scheduledAt === appointment.scheduledAt).map((entry) => entry.technicianId));
  if (tab === "Overview") {
    return <aside style={{ ...card, padding: 0, overflowY: "auto", maxHeight: "calc(100vh - 2rem)", position: "sticky", top: "1rem" }}>
      <div style={{ padding: "1.25rem 1.25rem 1rem", background: "linear-gradient(135deg, #7f1111, #b43d3d)", color: "#fff" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><div><div style={{ fontSize: "0.68rem", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Appointment detail</div><h2 style={{ margin: "0.3rem 0", fontSize: "1.35rem" }}>{client.name}</h2><div style={{ opacity: 0.85, fontSize: "0.78rem" }}>{formatDateTime(appointment.scheduledAt)}</div></div><button type="button" aria-label="Close appointment detail" onClick={onClose} style={{ border: 0, background: "transparent", color: "#fff", cursor: "pointer" }}><X size={18} /></button></div></div>
      <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #eadede" }}>{TAB_LABELS.map((label) => <button type="button" key={label} onClick={() => setTab(label)} style={{ flex: 1, minWidth: "88px", border: 0, borderBottom: tab === label ? `3px solid ${colors.brand}` : "3px solid transparent", padding: "0.8rem 0.35rem", background: "#fff", color: tab === label ? colors.brand : colors.muted, fontWeight: 800, fontSize: "0.72rem", cursor: "pointer" }}>{label}</button>)}</div>
      <div style={{ padding: "1.25rem" }}><AppointmentOverviewForm appointment={appointment} client={client} activeAccounts={activeAccounts} busyTechnicians={busyTechnicians} onSave={onSave} /></div>
    </aside>;
  }
  return (
    <aside style={{ ...card, padding: 0, overflowY: "auto", maxHeight: "calc(100vh - 2rem)", position: "sticky", top: "1rem" }}>
      <div style={{ padding: "1.25rem 1.25rem 1rem", background: "linear-gradient(135deg, #7f1111, #b43d3d)", color: "#fff" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><div><div style={{ fontSize: "0.68rem", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Appointment detail</div><h2 style={{ margin: "0.3rem 0", fontSize: "1.35rem" }}>{client.name}</h2><div style={{ opacity: 0.85, fontSize: "0.78rem" }}>{formatDateTime(appointment.scheduledAt)}</div></div><button type="button" aria-label="Close appointment detail" onClick={onClose} style={{ border: 0, background: "transparent", color: "#fff", cursor: "pointer" }}><X size={18} /></button></div></div>
      <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #eadede" }}>{TAB_LABELS.map((label) => <button type="button" key={label} onClick={() => setTab(label)} style={{ flex: 1, minWidth: "88px", border: 0, borderBottom: tab === label ? `3px solid ${colors.brand}` : "3px solid transparent", padding: "0.8rem 0.35rem", background: "#fff", color: tab === label ? colors.brand : colors.muted, fontWeight: 800, fontSize: "0.72rem", cursor: "pointer" }}>{label}</button>)}</div>
      <div style={{ padding: "1.25rem", maxHeight: "calc(100vh - 230px)", overflowY: "auto" }}>
        {tab === "Overview" && <form onSubmit={onSave} style={{ display: "grid", gap: "1rem" }}><InfoRow icon={<UserRound size={15} />} label="Client contact" value={`${client.phone || "No phone"} ${client.email ? `• ${client.email}` : ""}`} /><InfoRow icon={<MapPin size={15} />} label="Service address" value={client.address || "No address"} /><InfoRow icon={<UserRound size={15} />} label="Classification" value={client.classificationOther || client.classification || "Not classified"} /><div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Date and time</strong><input name="scheduledAt" type="datetime-local" defaultValue={toDateTimeLocal(appointment.scheduledAt)} style={inputStyle} /></div><div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Assign technician</strong><select name="technicianId" defaultValue={appointment.technicianId} style={inputStyle}><option value="">Unassigned</option>{activeAccounts.map((account) => <option key={account.id} value={account.id} disabled={busyTechnicians.has(account.id)}>{account.name || account.username}{busyTechnicians.has(account.id) ? " - busy at this time" : ""}</option>)}</select><span style={{ color: colors.muted, fontSize: "0.7rem" }}>Availability is checked against the current appointment board.</span></div><div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Status</strong><select name="status" defaultValue={appointment.status} style={inputStyle}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div><div style={{ display: "grid", gap: "0.4rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Visit notes</strong><textarea name="notes" defaultValue={appointment.notes} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></div><button type="submit" style={primaryButton}><Check size={15} /> Save appointment</button></form>}
        {tab === "Documents" && <ClientDocuments documents={client.documents || []} canUpload={canUpload} canRemove={canRemove} onUpload={(file) => addDocument(client.id, file)} onRemove={(document) => removeDocument(client.id, document)} onResolveUrl={getDocumentUrl} />}
        {tab === "Report" && <form onSubmit={onReportSubmit} style={{ display: "grid", gap: "1rem" }}><div style={{ padding: "0.85rem", borderRadius: "10px", background: "#f8fafc", color: colors.muted, fontSize: "0.78rem" }}><FileText size={15} style={{ verticalAlign: "middle", marginRight: "0.35rem" }} /> Record findings, treatment details, and follow-up recommendations.</div><textarea name="report" defaultValue={appointment.report} rows={9} placeholder="Inspection findings and treatment performed..." style={{ ...inputStyle, resize: "vertical" }} required /><button type="submit" style={primaryButton}><Check size={15} /> Submit report</button>{appointment.reportSubmitted && <div style={{ color: colors.success, fontWeight: 700, fontSize: "0.8rem" }}>Submitted. Service is Completed.</div>}</form>}
        {tab === "Stock-Out" && <StockOutForm appointment={appointment} inventory={inventory} stockRows={stockRows} setStockRows={setStockRows} onSubmit={onStockSubmit} />}
      </div>
    </aside>
  );
}

function TechnicianAvailability({ accounts, appointments, weekDays }) {
  return (
    <section style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid #eadede" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
        <div><div style={{ color: colors.brand, fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Dispatch</div><h2 style={{ margin: "0.25rem 0 0", color: colors.ink, fontSize: "1.1rem" }}>Technician availability</h2></div>
        <span style={{ color: colors.muted, fontSize: "0.75rem" }}>Booked times are shown from saved appointments.</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "700px", display: "grid", gridTemplateColumns: "150px repeat(7, minmax(80px, 1fr))", borderTop: "1px solid #eadede", borderLeft: "1px solid #eadede" }}>
          <div style={{ padding: "0.6rem", background: "#fffafa", color: colors.muted, fontSize: "0.7rem", fontWeight: 800 }}>Account</div>
          {weekDays.map((day) => <div key={localDateKey(day)} style={{ padding: "0.6rem 0.35rem", textAlign: "center", background: "#fffafa", borderRight: "1px solid #eadede", borderBottom: "1px solid #eadede", color: colors.muted, fontSize: "0.68rem", fontWeight: 800 }}>{day.toLocaleDateString([], { weekday: "short", day: "numeric" })}</div>)}
          {accounts.map((account) => <div key={account.id} style={{ display: "contents" }}><div style={{ padding: "0.65rem", borderRight: "1px solid #eadede", borderBottom: "1px solid #eadede", color: colors.ink, fontSize: "0.78rem", fontWeight: 700 }}>{account.name || account.username}</div>{weekDays.map((day) => { const dayAppointments = appointments.filter((appointment) => appointment.technicianId === account.id && appointment.status !== "Cancelled" && localDateKey(new Date(appointment.scheduledAt)) === localDateKey(day)); return <div key={`${account.id}-${localDateKey(day)}`} style={{ padding: "0.45rem", minHeight: "52px", borderRight: "1px solid #eadede", borderBottom: "1px solid #eadede", background: dayAppointments.length ? "#fff7ed" : "#f0fdf4", color: dayAppointments.length ? "#9a3412" : "#166534", fontSize: "0.68rem", lineHeight: 1.4 }}>{dayAppointments.length ? dayAppointments.map((appointment) => <div key={appointment.id}>{new Date(appointment.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {appointment.status}</div>) : "Available"}</div>; })}</div>)}
        </div>
      </div>
    </section>
  );
}

function StockOutForm({ appointment, inventory, stockRows, setStockRows, onSubmit }) {
  const updateRow = (rowId, field, value) => {
    setStockRows((current) => current.map((row) => row.id === rowId ? { ...row, [field]: value } : row));
  };

  const addRow = (category) => {
    setStockRows((current) => [...current, { id: `stock-row-${category}-${Date.now()}`, category, itemId: "", amount: "" }]);
  };

  const removeRow = (rowId) => {
    setStockRows((current) => current.length <= STOCK_CATEGORIES.length ? current : current.filter((row) => row.id !== rowId));
  };

  const categoryLabel = (category) => category.charAt(0) + category.slice(1).toLowerCase();

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
      <div style={{ padding: "0.85rem", borderRadius: "10px", background: "#fff7ed", color: "#9a3412", fontSize: "0.78rem" }}>
        <PackageCheck size={15} style={{ verticalAlign: "middle", marginRight: "0.35rem" }} /> Select every chemical, material, or equipment item used. All rows are submitted together.
      </div>
      {STOCK_CATEGORIES.map((category) => {
        const categoryRows = stockRows.filter((row) => row.category === category);
        const categoryItems = inventory.filter((item) => item.type === category && item.status !== "DISABLED");
        return (
          <section key={category} style={{ display: "grid", gap: "0.6rem", padding: "0.8rem", border: "1px solid #eadede", borderRadius: "10px", background: "#fffdfd" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: colors.ink, fontSize: "0.82rem" }}>{categoryLabel(category)}</strong>
              <button type="button" onClick={() => addRow(category)} style={{ ...secondaryButton, padding: "0.4rem 0.6rem", fontSize: "0.72rem" }}><Plus size={13} /> Add item</button>
            </div>
            {categoryRows.map((row) => {
              const selectedItemIds = new Set(categoryRows.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.itemId).filter(Boolean));
              return (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 82px auto", gap: "0.45rem", alignItems: "center" }}>
                  <select aria-label={`${categoryLabel(category)} item`} value={row.itemId} onChange={(event) => updateRow(row.id, "itemId", event.target.value)} style={{ ...inputStyle, padding: "0.62rem 0.55rem", fontSize: "0.78rem" }} required={categoryRows.length === 1 && categoryItems.length > 0}>
                    <option value="">Select item</option>
                    {categoryItems.map((item) => <option key={item.id} value={item.id} disabled={selectedItemIds.has(item.id)}>{item.name} ({item.quantity} {item.unit})</option>)}
                  </select>
                  <input aria-label={`${categoryLabel(category)} quantity`} type="number" min="1" step="1" value={row.amount} onChange={(event) => updateRow(row.id, "amount", event.target.value)} placeholder="Qty" style={{ ...inputStyle, padding: "0.62rem 0.55rem", fontSize: "0.78rem" }} />
                  {categoryRows.length > 1 && <button type="button" aria-label={`Remove ${categoryLabel(category)} row`} onClick={() => removeRow(row.id)} style={{ border: 0, background: "transparent", color: colors.danger, cursor: "pointer", padding: "0.4rem" }}><X size={15} /></button>}
                </div>
              );
            })}
            {categoryItems.length === 0 && <span style={{ color: colors.muted, fontSize: "0.72rem" }}>No active {categoryLabel(category).toLowerCase()} inventory items.</span>}
          </section>
        );
      })}
      <button type="submit" style={primaryButton}><PackageCheck size={15} /> Record stock out</button>
      {(appointment.stockUsed || []).length > 0 && <div style={{ display: "grid", gap: "0.45rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Recorded for this service</strong>{appointment.stockUsed.map((entry, index) => <div key={`${entry.itemId}-${index}`} style={{ display: "flex", justifyContent: "space-between", padding: "0.55rem 0.7rem", border: "1px solid #eadede", borderRadius: "8px", fontSize: "0.78rem" }}><span>{entry.name}</span><strong>{entry.amount} {entry.unit}</strong></div>)}</div>}
    </form>
  );
}

function CreateAppointmentModalV2({ clients, activeAccounts, onClose, onCreate }) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const values = new FormData(event.currentTarget);
    const result = await onCreate({
      clientId: values.get("clientId"),
      scheduledAt: values.get("scheduledAt"),
      durationMinutes: readDuration(values),
      pestConcern: values.get("pestConcern"),
      technicianId: values.get("technicianId"),
      notes: values.get("notes"),
    });
    if (typeof result === "string") setFormError(result);
    setSaving(false);
  };

  return <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 20, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.42)" }}>
    <form onSubmit={handleSubmit} style={{ ...card, width: "min(100%, 520px)", maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}><div><div style={{ color: colors.brand, fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Scheduling</div><h2 style={{ margin: "0.25rem 0 0", color: colors.ink }}>New appointment</h2></div><button type="button" aria-label="Close new appointment" onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer", color: colors.muted }}><X size={18} /></button></div>
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Client<select name="clientId" style={inputStyle} required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Date and time<input name="scheduledAt" type="datetime-local" defaultValue={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} style={inputStyle} required /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontWeight: 700, fontSize: "0.72rem" }}>Hours<input name="durationHours" type="number" min="0" max="24" defaultValue="1" style={{ ...inputStyle, padding: "0.55rem" }} required /></label><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontWeight: 700, fontSize: "0.72rem" }}>Minutes<input name="durationMinutes" type="number" min="0" max="59" defaultValue="0" style={{ ...inputStyle, padding: "0.55rem" }} required /></label></div>
        <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Technician<select name="technicianId" defaultValue="" style={inputStyle}><option value="">Unassigned</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name || account.username}</option>)}</select></label>
        <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Pest concern<select name="pestConcern" style={inputStyle}><option value="">Select a pest concern</option>{PEST_CONCERN_SUGGESTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Notes<textarea name="notes" rows={3} style={{ ...inputStyle, resize: "vertical" }} /></label>
      </div>
      {formError && <div role="alert" style={{ marginTop: "0.9rem", color: colors.danger, fontWeight: 700, fontSize: "0.8rem" }}>{formError}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "1.25rem" }}><button type="button" onClick={onClose} style={secondaryButton}>Cancel</button><button type="submit" disabled={saving || clients.length === 0} style={primaryButton}>{saving ? "Creating..." : "Create appointment"}</button></div>
    </form>
  </div>;
}

function CreateAppointmentModal({ clients, activeAccounts, onClose, onCreate }) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const values = new FormData(event.currentTarget);
    const result = await onCreate({
      clientId: values.get("clientId"),
      scheduledAt: values.get("scheduledAt"),
      durationMinutes: readDuration(values),
      pestConcern: values.get("pestConcern"),
      technicianId: values.get("technicianId"),
      notes: values.get("notes"),
    });
    if (typeof result === "string") setFormError(result);
    setSaving(false);
  };

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 20, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.42)" }}>
      <form onSubmit={handleSubmit} style={{ ...card, width: "min(100%, 520px)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}><div><div style={{ color: colors.brand, fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Scheduling</div><h2 style={{ margin: "0.25rem 0 0", color: colors.ink }}>New appointment</h2></div><button type="button" aria-label="Close new appointment" onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer", color: colors.muted }}><X size={18} /></button></div>
        <div style={{ display: "grid", gap: "1rem" }}><label style={{ display: "grid", gap: "0.4rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Client<select name="clientId" style={inputStyle} required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label style={{ display: "grid", gap: "0.4rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Date and time<input name="scheduledAt" type="datetime-local" defaultValue={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} style={inputStyle} required /></label><label style={{ display: "grid", gap: "0.4rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Technician or staff<select name="technicianId" defaultValue="" style={inputStyle}><option value="">Unassigned</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name || account.username}</option>)}</select></label><label style={{ display: "grid", gap: "0.4rem", color: colors.body, fontWeight: 700, fontSize: "0.82rem" }}>Notes<textarea name="notes" rows={3} style={{ ...inputStyle, resize: "vertical" }} /></label></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", marginTop: "1rem" }}><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontSize: "0.72rem", fontWeight: 700 }}>Hours<input name="durationHours" type="number" min="0" max="24" defaultValue="1" style={{ ...inputStyle, padding: "0.5rem" }} required /></label><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontSize: "0.72rem", fontWeight: 700 }}>Minutes<input name="durationMinutes" type="number" min="0" max="59" defaultValue="0" style={{ ...inputStyle, padding: "0.5rem" }} required /></label></div><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontSize: "0.72rem", fontWeight: 700, marginTop: "0.65rem" }}>Pest concern<select name="pestConcern" style={{ ...inputStyle, padding: "0.5rem" }}><option value="">Select a pest concern</option>{PEST_CONCERN_SUGGESTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        {formError && <div role="alert" style={{ marginTop: "0.9rem", color: colors.danger, fontWeight: 700, fontSize: "0.8rem" }}>{formError}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "1.25rem" }}><button type="button" onClick={onClose} style={secondaryButton}>Cancel</button><button type="submit" disabled={saving || clients.length === 0} style={primaryButton}>{saving ? "Creating..." : "Create appointment"}</button></div>
      </form>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", paddingBottom: "0.85rem", borderBottom: "1px solid #f1e7e7" }}><span style={{ color: colors.brand, marginTop: "0.1rem" }}>{icon}</span><div><div style={{ color: colors.muted, fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ color: colors.ink, fontSize: "0.84rem", marginTop: "0.18rem", lineHeight: 1.45 }}>{value}</div></div></div>;
}

export default SchedulingPage;
