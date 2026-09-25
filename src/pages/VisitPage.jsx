// A visit in progress, on the technician's phone: /visit/:id.
//
// Four steps — Findings, Treatment, Photos, Sign — one screen each, with a
// fixed footer carrying the one primary action. What the technician types is
// saved on the phone as they go (utils/techDay draft helpers), so a dropped
// signal or an accidental Back loses nothing; the office sees it when the
// report is sent from the Sign step.
//
// Sending uses the same calls as the Report and Stock-Out tabs on the
// Schedule page: signatures are uploaded first (their object keys go into
// the report), then submit_appointment_report, then the materials are
// recorded as stock out against the visit. The customer's signature is what
// completes the visit (migration 034); without it the report is filed and
// the visit stays open for signing.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Camera, Check, ChevronLeft, Minus, Plus } from "lucide-react";
import useAuth from "../hooks/useAuth";
import useClients from "../hooks/useClients";
import useInventory from "../hooks/useInventory";
import useNow from "../hooks/useNow";
import useServices from "../hooks/useServices";
import useTreatmentMethods from "../hooks/useTreatmentMethods";
import { useScheduling } from "../context/SchedulingContext";
import { useToast } from "../context/ToastContext";
import SignaturePad from "../components/scheduling/SignaturePad";
import Button from "../components/ui/Button";
import StatusPill from "../components/ui/StatusPill";
import { ROLES } from "../utils/constants";
import { isAssignedTo } from "../utils/scheduling";
import { todayISO, validateAttachment } from "../utils/validators";
import {
  VISIT_STEPS,
  adjustAmount,
  canStart,
  clearDraft,
  loadDraft,
  materialsFromService,
  minutesOnSite,
  saveDraft,
  stepFor,
} from "../utils/techDay";
import { brand, font, neutral, radius, status as semantic, surface, weight } from "../styles/tokens";
import { colors } from "../styles/theme";

const label = { margin: "0 0 8px", fontSize: "11.5px", letterSpacing: "0.09em", textTransform: "uppercase", color: neutral.saddle };
const field = {
  width: "100%",
  border: `1px solid ${neutral.loam}`,
  borderRadius: radius.control,
  background: surface.panel,
  padding: "12px",
  fontSize: "16px", // 16px stops iOS zooming into the field
  color: neutral.ink,
  fontFamily: "inherit",
};

const PHOTO_CATEGORIES = [
  { value: "BEFORE", label: "Before" },
  { value: "AFTER", label: "After" },
  { value: "INSPECTION", label: "Inspection" },
];

function Toggle({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        minHeight: "48px",
        padding: "0 16px",
        borderRadius: radius.control,
        border: `1px solid ${selected ? neutral.ink : neutral.loam}`,
        background: selected ? neutral.ink : surface.panel,
        color: selected ? surface.canvas : neutral.ink,
        fontSize: "15px",
        fontWeight: weight.medium,
        cursor: "pointer",
      }}
    >
      {selected && <Check size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

function Stepper({ value, unit, onChange, name }) {
  const step = stepFor(unit);
  const box = { width: "44px", height: "44px", border: `1px solid ${colors.line}`, borderRadius: radius.control, background: surface.panel, display: "grid", placeItems: "center", cursor: "pointer" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button type="button" aria-label={`Less ${name}`} onClick={() => onChange(adjustAmount(value, -step, step))} style={box}>
        <Minus size={16} />
      </button>
      <span style={{ minWidth: "64px", textAlign: "center", fontWeight: 600, fontSize: "16px", fontVariantNumeric: "tabular-nums" }}>
        {value} {unit}
      </span>
      <button type="button" aria-label={`More ${name}`} onClick={() => onChange(adjustAmount(value, step, step))} style={box}>
        <Plus size={16} />
      </button>
    </div>
  );
}

function VisitPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow(60000);
  const { currentUser } = useAuth();
  const { clients } = useClients();
  const { inventory, stockOutMany } = useInventory();
  const { serviceById, serviceByName } = useServices();
  const { methods } = useTreatmentMethods();
  const { appointments, loading, startVisit, submitReport, uploadSignature, addAttachment, addStockUsed } = useScheduling();
  const { showError, showSuccess } = useToast();

  const appointment = appointments.find((entry) => entry.id === id) || null;
  const client = appointment ? clients.find((entry) => entry.id === appointment.clientId) : null;
  const service = appointment ? serviceById(appointment.serviceId) || serviceByName(appointment.serviceType) : null;
  const isTechnician = currentUser?.role === ROLES.TECHNICIAN;
  const mine = appointment && (!isTechnician || isAssignedTo(appointment, currentUser?.id));
  const alreadyStocked = (appointment?.stockUsed || []).length > 0;

  const initialStep = VISIT_STEPS.includes(searchParams.get("step")) ? searchParams.get("step") : "Findings";
  const [step, setStep] = useState(initialStep);
  const [draft, setDraft] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [photoCategory, setPhotoCategory] = useState("BEFORE");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const customerPad = useRef(null);
  const technicianPad = useRef(null);

  // Load the draft once the visit is known: what was typed on this phone
  // before, else what the office already has, with materials prefilled from
  // the service profile.
  useEffect(() => {
    if (!appointment || draft) return;
    const stored = loadDraft(appointment.id);
    setDraft(
      stored || {
        findings: appointment.report || "",
        recommendations: appointment.recommendations || "",
        treatmentMethods: appointment.treatmentMethods || [],
        notes: appointment.treatmentPerformed || "",
        materials: alreadyStocked ? [] : materialsFromService(service, inventory),
        customerName: appointment.customerName || "",
      }
    );
    if (stored?.savedAt) setSavedAt(stored.savedAt);
  }, [appointment, draft, service, inventory, alreadyStocked]);

  const update = (changes) => {
    setDraft((current) => {
      const next = { ...current, ...changes };
      if (saveDraft(id, next)) setSavedAt(new Date().toISOString());
      return next;
    });
  };

  const inventoryById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const addableItems = inventory.filter((item) => item.status !== "DISABLED" && !(draft?.materials || []).some((material) => material.itemId === item.id));

  if (loading && !appointment) return <p style={{ color: neutral.bark }}>Loading visit…</p>;
  if (!appointment) {
    return (
      <p>
        That visit could not be found. <Link to="/">Back to your day</Link>
      </p>
    );
  }
  if (!mine) {
    return (
      <p>
        This visit is not assigned to you. <Link to="/">Back to your day</Link>
      </p>
    );
  }
  if (!draft) return null;

  const stepIndex = VISIT_STEPS.indexOf(step);
  const onSite = minutesOnSite(appointment, now);
  const photos = appointment.attachments || [];

  const handleStart = async () => {
    setStarting(true);
    const result = await startVisit(appointment.id);
    setStarting(false);
    if (result !== true) showError(result);
  };

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateAttachment(file);
    if (problem) {
      showError(problem);
      return;
    }
    setUploading(true);
    const result = await addAttachment(appointment.id, file, photoCategory);
    setUploading(false);
    if (result !== true) showError(result);
  };

  const stepProblem = (name) => {
    if (name === "Findings" && !draft.findings.trim()) return "Write what you found before moving on.";
    if (name === "Treatment" && draft.treatmentMethods.length === 0 && !draft.notes.trim()) {
      return "Tick at least one method, or describe the treatment in the notes.";
    }
    return null;
  };

  const goNext = () => {
    const problem = stepProblem(step);
    if (problem) {
      showError(problem);
      return;
    }
    setStep(VISIT_STEPS[stepIndex + 1]);
    window.scrollTo?.(0, 0);
  };

  const send = async () => {
    const problem = stepProblem("Findings") || stepProblem("Treatment");
    if (problem) {
      showError(problem);
      return;
    }
    setSending(true);
    try {
      const report = {
        findings: draft.findings.trim(),
        treatmentPerformed: draft.notes.trim(),
        treatmentMethods: draft.treatmentMethods,
        recommendations: draft.recommendations.trim(),
        followUpDate: appointment.followUpDate || "",
      };

      const customerFile = await customerPad.current?.toFile();
      if (customerFile) {
        if (!draft.customerName.trim()) {
          showError("Add the customer's name next to their signature.");
          return;
        }
        const upload = await uploadSignature(appointment.id, customerFile);
        if (upload.error) {
          showError(upload.error);
          return;
        }
        report.signaturePath = upload.storagePath;
        report.customerName = draft.customerName.trim();
      }
      const technicianFile = await technicianPad.current?.toFile();
      if (technicianFile) {
        const upload = await uploadSignature(appointment.id, technicianFile, "technician");
        if (upload.error) {
          showError(upload.error);
          return;
        }
        report.technicianSignaturePath = upload.storagePath;
      }

      const result = await submitReport(appointment.id, report);
      if (typeof result === "string") {
        showError(result);
        return;
      }

      // Materials last: a report is the record that matters, and a stock
      // problem (say, less on hand than typed) must not lose it.
      const entries = draft.materials.filter((material) => Number(material.amount) > 0).map((material) => ({ itemId: material.itemId, amount: Number(material.amount), batchNumber: "" }));
      if (entries.length && !alreadyStocked) {
        const stocked = await stockOutMany(appointment.id, entries, todayISO());
        if (typeof stocked === "string") {
          showError(`Report sent, but the materials weren't recorded: ${stocked} Record them from the visit's Stock-Out tab.`);
        } else {
          entries.forEach((entry) => {
            const item = inventoryById.get(entry.itemId);
            addStockUsed(appointment.id, { itemId: entry.itemId, name: item?.name || "Inventory item", amount: entry.amount, unit: item?.unit || "", batchNumber: "", date: todayISO() });
          });
        }
      }

      clearDraft(appointment.id);
      showSuccess(report.signaturePath ? "Visit completed and signed." : "Report sent. The visit stays open until the customer signs.");
      navigate("/");
    } finally {
      setSending(false);
    }
  };

  const footerAction =
    step === "Sign" ? (
      <Button variant="primary" size="lg" loading={sending} onClick={send} icon={<Check size={18} />}>
        {sending ? "Sending…" : "Send report"}
      </Button>
    ) : (
      <Button variant="primary" size="lg" onClick={goNext}>
        Next: {VISIT_STEPS[stepIndex + 1]} <ArrowRight size={18} aria-hidden="true" />
      </Button>
    );

  return (
    <div className="visit-page" style={{ maxWidth: "640px", margin: "0 auto", paddingBottom: "96px" }}>
      <header style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
        <Link to="/" aria-label="Back to your day" style={{ color: neutral.ink, padding: "6px 4px 0 0" }}>
          <ChevronLeft size={24} />
        </Link>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, font: `500 26px/1.2 ${font.display}` }}>{client?.name || "Visit"}</h1>
          <p style={{ margin: "4px 0 0", color: neutral.saddle }}>
            {appointment.status === "In progress" && appointment.startedAt
              ? `Visit started ${new Date(appointment.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${onSite} min`
              : new Date(appointment.scheduledAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <span style={{ marginLeft: "auto" }}>
          <StatusPill status={appointment.status} />
        </span>
      </header>

      {canStart(appointment, now) && (
        <div style={{ marginTop: "14px", padding: "12px 14px", borderRadius: radius.card, background: semantic.warningSurface, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ color: semantic.warning, flex: 1 }}>This visit hasn't been started yet.</span>
          <Button size="sm" variant="secondary" loading={starting} onClick={handleStart}>
            Start visit now
          </Button>
        </div>
      )}

      <ol aria-label="Steps" style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "grid", gridTemplateColumns: `repeat(${VISIT_STEPS.length}, 1fr)`, gap: "8px" }}>
        {VISIT_STEPS.map((name, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;
          return (
            <li key={name}>
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => setStep(name)}
                style={{ width: "100%", border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "center" }}
              >
                <span style={{ display: "block", height: "4px", borderRadius: "2px", background: done ? semantic.success : current ? brand.base : surface.sunken }} />
                <span style={{ display: "block", marginTop: "6px", fontSize: "13.5px", color: done ? semantic.success : current ? brand.base : neutral.bark, fontWeight: current ? weight.medium : weight.regular }}>
                  {name}
                  {done ? " ✓" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div style={{ marginTop: "22px" }}>
        {step === "Findings" && (
          <>
            <label style={{ display: "block" }}>
              <p style={label}>What did you find?</p>
              <textarea
                aria-label="Findings"
                rows={6}
                value={draft.findings}
                onChange={(event) => update({ findings: event.target.value })}
                placeholder="Activity, harborage, entry points…"
                style={field}
              />
            </label>
            <label style={{ display: "block", marginTop: "18px" }}>
              <p style={label}>Recommendations for the client</p>
              <textarea
                aria-label="Recommendations"
                rows={3}
                value={draft.recommendations}
                onChange={(event) => update({ recommendations: event.target.value })}
                placeholder="Seal gaps under the back door…"
                style={field}
              />
            </label>
          </>
        )}

        {step === "Treatment" && (
          <>
            <p style={label}>Methods used</p>
            <div role="group" aria-label="Methods used" style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {methods.map((method) => {
                const selected = draft.treatmentMethods.includes(method.value);
                return (
                  <Toggle
                    key={method.value}
                    selected={selected}
                    onClick={() =>
                      update({
                        treatmentMethods: selected ? draft.treatmentMethods.filter((value) => value !== method.value) : [...draft.treatmentMethods, method.value],
                      })
                    }
                  >
                    {method.label}
                  </Toggle>
                );
              })}
              {methods.length === 0 && <span style={{ color: neutral.bark }}>No treatment methods are set up. Describe the treatment in the notes below.</span>}
            </div>

            <p style={{ ...label, marginTop: "24px" }}>
              Materials used{service?.materials?.length && !alreadyStocked ? <span style={{ textTransform: "none", letterSpacing: 0, color: neutral.bark }}> · prefilled from service</span> : null}
            </p>
            {alreadyStocked ? (
              <p style={{ margin: 0, color: neutral.saddle }}>
                Already recorded for this visit: {(appointment.stockUsed || []).map((entry) => `${entry.name} ${entry.amount} ${entry.unit}`).join(", ")}.
              </p>
            ) : (
              <div style={{ border: `1px solid ${colors.line}`, borderRadius: radius.card, background: surface.panel }}>
                {draft.materials.map((material, index) => {
                  const item = inventoryById.get(material.itemId);
                  if (!item) return null;
                  return (
                    <div key={material.itemId} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderBottom: `1px solid ${colors.line}`, flexWrap: "wrap" }}>
                      <span style={{ flex: 1, minWidth: "140px" }}>
                        <span style={{ display: "block", fontWeight: weight.medium }}>{item.name}</span>
                        <span style={{ display: "block", color: neutral.bark, fontSize: "13px" }}>
                          {item.quantity} {item.unit} in stock
                        </span>
                      </span>
                      <Stepper
                        name={item.name}
                        value={material.amount}
                        unit={item.unit}
                        onChange={(amount) => update({ materials: draft.materials.map((entry, position) => (position === index ? { ...entry, amount } : entry)) })}
                      />
                    </div>
                  );
                })}
                <div style={{ padding: "10px 14px" }}>
                  <select
                    aria-label="Add material"
                    value=""
                    onChange={(event) => event.target.value && update({ materials: [...draft.materials, { itemId: event.target.value, amount: 0 }] })}
                    style={{ ...field, padding: "10px", color: brand.base, fontWeight: weight.medium }}
                  >
                    <option value="">+ Add material</option>
                    {addableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.quantity} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <label style={{ display: "block", marginTop: "24px" }}>
              <p style={label}>Notes</p>
              <textarea aria-label="Treatment notes" rows={3} value={draft.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Where and how it was applied…" style={field} />
            </label>
          </>
        )}

        {step === "Photos" && (
          <>
            <p style={label}>Photo type</p>
            <div role="group" aria-label="Photo type" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {PHOTO_CATEGORIES.map((category) => (
                <Toggle key={category.value} selected={photoCategory === category.value} onClick={() => setPhotoCategory(category.value)}>
                  {category.label}
                </Toggle>
              ))}
            </div>
            <label
              style={{
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                minHeight: "140px",
                border: `1.5px dashed ${neutral.loam}`,
                borderRadius: radius.card,
                background: surface.panel,
                cursor: uploading ? "default" : "pointer",
                color: neutral.saddle,
              }}
            >
              <Camera size={28} aria-hidden="true" />
              {uploading ? "Uploading…" : "Take or choose a photo"}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={uploading} aria-label="Add photo" style={{ display: "none" }} />
            </label>
            <p style={{ margin: "12px 0 0", color: neutral.bark, fontSize: "13px" }}>
              {photos.length === 0 ? "No photos yet. Photos upload as you take them." : `${photos.length} ${photos.length === 1 ? "file" : "files"} on this visit.`}
            </p>
          </>
        )}

        {step === "Sign" && (
          <>
            <p style={label}>Customer signature</p>
            {appointment.signaturePath ? (
              <p style={{ margin: 0, color: semantic.success }}>Signed by {appointment.customerName || "the customer"}.</p>
            ) : (
              <>
                <input
                  aria-label="Customer name"
                  value={draft.customerName}
                  onChange={(event) => update({ customerName: event.target.value })}
                  placeholder="Customer's name"
                  style={{ ...field, marginBottom: "10px" }}
                />
                <SignaturePad ref={customerPad} />
                <p style={{ margin: "8px 0 0", color: neutral.bark, fontSize: "13px" }}>The customer's signature completes the visit. Without it the report is filed and the visit stays open.</p>
              </>
            )}
            <p style={{ ...label, marginTop: "24px" }}>Your signature</p>
            {appointment.technicianSignaturePath ? (
              <p style={{ margin: 0, color: semantic.success }}>You signed this report.</p>
            ) : (
              <SignaturePad ref={technicianPad} height={130} />
            )}
          </>
        )}
      </div>

      <footer className="visit-footer">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: neutral.bark, fontSize: "13px" }}>
          {savedAt ? (
            <>
              <Check size={14} aria-hidden="true" /> Saved on this phone
            </>
          ) : (
            "Not saved yet"
          )}
        </span>
        {footerAction}
      </footer>
    </div>
  );
}

export default VisitPage;
