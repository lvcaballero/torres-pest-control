// The New appointment form.
//
// Previously nine fields stacked in a 460px column with no grouping: Client,
// Date and time, Hours, Minutes, Technician, Service type, Service location,
// Pest concern, Notes. Same fields, now in four labelled sections across two
// columns, so the form reads as "who, when, what work, who does it" instead
// of as a list.
//
// Two behavioural additions, both using logic that already existed and was
// simply not wired to this form:
//
//   - describeSlotConflict runs as the user types, so a clash is reported
//     before submitting rather than after a failed round trip.
//   - busyTechnicianIds marks technicians already booked in the chosen
//     window. The detail panel's form already did this; this one did not.
//
// The submit path is deliberately unchanged: still uncontrolled fields read
// through FormData, still returning the caller's error string on failure.

import { useMemo, useState } from "react";
import { AlertTriangle, MapPin, Phone } from "lucide-react";
import { neutral, radius, status, surface, text, weight } from "../../styles/tokens";
import { PEST_CONCERN_SUGGESTIONS, SERVICE_TYPES } from "../../utils/constants";
import { defaultAppointmentDateTime } from "../../utils/calendarDates";
import { busyTechnicianIds, describeSlotConflict } from "../../utils/scheduling";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import ClientCombobox from "./ClientCombobox";

/** The durations the office actually books. Custom reveals the raw fields. */
const DURATION_PRESETS = [30, 60, 90, 120];

const CUSTOM = "custom";

function Section({ legend, span = 1, children }) {
  return (
    <fieldset
      style={{
        gridColumn: span === 2 ? "1 / -1" : "auto",
        border: "none",
        borderTop: `1px solid ${surface.sunken}`,
        margin: 0,
        padding: "12px 0 0",
        minWidth: 0,
        display: "grid",
        gap: "12px",
      }}
    >
      <legend
        style={{
          ...text.caption,
          textTransform: "uppercase",
          letterSpacing: "0.058em",
          color: neutral.bark,
          fontWeight: weight.medium,
          padding: "0 8px 0 0",
        }}
      >
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function NewAppointmentModal({
  clients,
  activeAccounts,
  appointments = [],
  initialClientId = "",
  initialScheduledAt = "",
  onClose,
  onCreate,
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [clientId, setClientId] = useState(initialClientId);
  const initialClient = clients.find((client) => client.id === initialClientId) || null;
  const [serviceLocation, setServiceLocation] = useState(initialClient?.address || "");

  const [scheduledAt, setScheduledAt] = useState(
    initialScheduledAt || defaultAppointmentDateTime()
  );
  const [durationChoice, setDurationChoice] = useState(60);
  const [customHours, setCustomHours] = useState(1);
  const [customMinutes, setCustomMinutes] = useState(0);
  const [technicianId, setTechnicianId] = useState("");

  const selectedClient = clients.find((client) => client.id === clientId) || null;

  const durationMinutes =
    durationChoice === CUSTOM
      ? (Number(customHours) || 0) * 60 + (Number(customMinutes) || 0)
      : durationChoice;

  const busyIds = useMemo(() => {
    if (!scheduledAt || !durationMinutes) return new Set();
    return busyTechnicianIds(appointments, { id: null, scheduledAt, durationMinutes });
  }, [appointments, scheduledAt, durationMinutes]);

  // The same check the server will run, reported while the user is still in
  // the form rather than after a rejected round trip.
  const conflict = useMemo(() => {
    if (!scheduledAt || !durationMinutes) return null;
    return describeSlotConflict(appointments, {
      id: null,
      scheduledAt,
      durationMinutes,
      technicianId: technicianId || null,
    });
  }, [appointments, scheduledAt, durationMinutes, technicianId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!clientId) {
      setFormError("Select a client from the list.");
      return;
    }

    setSaving(true);
    setFormError("");

    const values = new FormData(event.currentTarget);
    const result = await onCreate({
      clientId: values.get("clientId"),
      scheduledAt: values.get("scheduledAt"),
      durationMinutes,
      pestConcern: values.get("pestConcern"),
      serviceType: values.get("serviceType") || "",
      serviceLocation: values.get("serviceLocation") || "",
      technicianId: values.get("technicianId"),
      notes: values.get("notes"),
    });

    // The context mutators report failure by returning the message.
    if (typeof result === "string") setFormError(result);
    setSaving(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Scheduling"
      title="New appointment"
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="new-appointment-form"
            variant="primary"
            loading={saving}
            disabled={clients.length === 0}
          >
            {saving ? "Creating..." : "Create appointment"}
          </Button>
        </>
      }
    >
      <form
        id="new-appointment-form"
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "15px 20px",
        }}
      >
        <Section legend="Client" span={2}>
          <Field label="Client" required>
            <ClientCombobox
              clients={clients}
              value={clientId}
              initialSearch={initialClient?.name || ""}
              onChange={(id, client) => {
                setClientId(id);
                setServiceLocation(client?.address || "");
              }}
            />
          </Field>

          {selectedClient && (
            <div
              style={{
                display: "flex",
                gap: "15px",
                flexWrap: "wrap",
                padding: "9px 12px",
                background: surface.sunken,
                borderRadius: radius.control,
                ...text.caption,
                color: neutral.saddle,
              }}
            >
              {selectedClient.address && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <MapPin size={12} aria-hidden="true" />
                  {selectedClient.address}
                </span>
              )}
              {selectedClient.phone && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <Phone size={12} aria-hidden="true" />
                  {selectedClient.phone}
                </span>
              )}
            </div>
          )}

          <Field label="Service location" hint="Defaults to the client's address">
            <Input
              name="serviceLocation"
              value={serviceLocation}
              onChange={(event) => setServiceLocation(event.target.value)}
              placeholder="Defaults to the client's address"
            />
          </Field>
        </Section>

        <Section legend="When">
          <Field label="Date and time" required>
            <Input
              name="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
            />
          </Field>

          {/* A radiogroup of toggle buttons, NOT a labelled control. Wrapping
              these in Field's <label> made the first button inherit the
              label's whole text as its accessible name, because a <label>
              implicitly labels its first labelable descendant and a button
              is labelable. */}
          <div role="group" aria-label="Duration" style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: neutral.ink, fontWeight: weight.medium, fontSize: text.small.fontSize }}>
              Duration
            </span>
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {DURATION_PRESETS.map((minutes) => (
                <Button
                  key={minutes}
                  size="sm"
                  onClick={() => setDurationChoice(minutes)}
                  aria-pressed={durationChoice === minutes}
                  style={
                    durationChoice === minutes
                      ? { borderColor: "#7f1111", color: "#8b1e1e", background: "rgba(127, 17, 17, 0.06)" }
                      : undefined
                  }
                >
                  {minutes < 60 ? `${minutes}m` : minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
                </Button>
              ))}
              <Button
                size="sm"
                onClick={() => setDurationChoice(CUSTOM)}
                aria-pressed={durationChoice === CUSTOM}
                style={
                  durationChoice === CUSTOM
                    ? { borderColor: "#7f1111", color: "#8b1e1e", background: "rgba(127, 17, 17, 0.06)" }
                    : undefined
                }
              >
                Custom
              </Button>
            </div>
          </div>

          {durationChoice === CUSTOM && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <Field label="Hours">
                <Input
                  type="number"
                  min="0"
                  max="24"
                  value={customHours}
                  onChange={(event) => setCustomHours(event.target.value)}
                />
              </Field>
              <Field label="Minutes">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                />
              </Field>
            </div>
          )}
        </Section>

        <Section legend="Assignment">
          <Field
            label="Technician"
            hint={busyIds.size > 0 ? "Technicians already booked in this window are marked." : undefined}
          >
            <Select
              name="technicianId"
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name || account.username}
                  {busyIds.has(account.id) ? " — already booked" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section legend="Work" span={2}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            <Field label="Service type">
              <Select name="serviceType" defaultValue="">
                <option value="">Select a service type</option>
                {SERVICE_TYPES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </Field>

            <Field label="Pest concern">
              <Select name="pestConcern" defaultValue="">
                <option value="">Select a pest concern</option>
                {PEST_CONCERN_SUGGESTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea name="notes" rows={3} />
          </Field>
        </Section>

        {/* Advisory, not blocking: the server is still the authority, and a
            stale appointments list should never stop someone booking. */}
        {conflict && !formError && (
          <p
            role="status"
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              margin: 0,
              padding: "9px 12px",
              background: status.warningSurface,
              color: status.warning,
              borderRadius: radius.control,
              ...text.small,
            }}
          >
            <AlertTriangle size={14} aria-hidden="true" />
            {conflict}
          </p>
        )}

        {formError && (
          <p
            role="alert"
            style={{
              gridColumn: "1 / -1",
              margin: 0,
              padding: "9px 12px",
              background: status.dangerSurface,
              color: status.danger,
              borderRadius: radius.control,
              ...text.small,
            }}
          >
            {formError}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default NewAppointmentModal;
