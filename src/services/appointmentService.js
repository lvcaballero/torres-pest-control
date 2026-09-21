import { supabase } from "./supabaseClient";

// File bytes for report attachments live here; the table holds only metadata.
// Same arrangement as client-documents — see clientService.js.
const ATTACHMENT_BUCKET = "report-attachments";
const ATTACHMENT_COLUMNS = "id, appointment_id, name, mime_type, size_bytes, storage_path, category, uploaded_at";
const SIGNED_URL_TTL_SECONDS = 60;

const APPOINTMENT_COLUMNS = "id, client_id, scheduled_at, duration_minutes, pest_concern, service_type, service_location, cancellation_reason, technician_id, status, notes, created_by, service_frequency, price, created_at, updated_at";
const REPORT_COLUMNS = "appointment_id, findings, treatment_performed, recommendations, follow_up_date, submitted_by, submitted_at, customer_name, signature_path, signed_at, completion_note, technician_signature_path, technician_signed_at, treatment_methods";

function describeError(error) {
  if (!error) return "Unknown error";
  return [error.message || "Unknown error", error.details ? ` - ${error.details}` : "", error.hint ? ` (hint: ${error.hint})` : ""].join("");
}

export function mapAppointmentRow(row, report = null) {
  return {
    id: row.id,
    clientId: row.client_id,
    scheduledAt: row.scheduled_at,
    durationMinutes: Number(row.duration_minutes) || 60,
    pestConcern: row.pest_concern || "",
    serviceType: row.service_type || "",
    serviceLocation: row.service_location || "",
    cancellationReason: row.cancellation_reason || "",
    technicianId: row.technician_id || "",
    // The whole crew, lead first. technicianId is kept as the lead so the
    // calendar colours, the printed form and every existing query that asks
    // for "the technician" keep working — see migration 041.
    technicianIds: Array.isArray(row.technicianIds)
      ? row.technicianIds
      : (row.technician_id ? [row.technician_id] : []),
    status: row.status,
    notes: row.notes || "",
    serviceFrequency: row.service_frequency || "",
    price: row.price === null || row.price === undefined ? "" : Number(row.price),
    report: report?.findings || "",
    treatmentPerformed: report?.treatment_performed || "",
    treatmentMethods: report?.treatment_methods || [],
    recommendations: report?.recommendations || "",
    followUpDate: report?.follow_up_date || "",
    reportSubmitted: Boolean(report),
    reportSubmittedAt: report?.submitted_at || "",
    customerName: report?.customer_name || "",
    signaturePath: report?.signature_path || "",
    signedAt: report?.signed_at || "",
    technicianSignaturePath: report?.technician_signature_path || "",
    technicianSignedAt: report?.technician_signed_at || "",
    completionNote: report?.completion_note || "",
    attachments: row.attachments || [],
    stockUsed: row.stockUsed || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAppointments() {
  const [appointmentsResult, reportsResult, stockResult, attachmentsResult, crewResult] = await Promise.all([
    supabase.from("appointments").select(APPOINTMENT_COLUMNS).order("scheduled_at", { ascending: true }),
    supabase.from("appointment_reports").select(REPORT_COLUMNS),
    supabase.from("inventory_movements").select("item_id, appointment_id, amount, movement_date, batch_number, inventory(name, unit)").eq("movement_type", "OUT").not("appointment_id", "is", null),
    supabase.from("appointment_report_attachments").select(ATTACHMENT_COLUMNS).order("uploaded_at", { ascending: false }),
    supabase.from("appointment_technicians").select("appointment_id, technician_id, is_lead, assigned_at"),
  ]);
  const error = appointmentsResult.error || reportsResult.error || stockResult.error || attachmentsResult.error || crewResult.error;
  if (error) return { error: describeError(error), appointments: [] };
  const reports = new Map((reportsResult.data || []).map((report) => [report.appointment_id, report]));
  const stockByAppointment = new Map();
  (stockResult.data || []).forEach((movement) => {
    const entries = stockByAppointment.get(movement.appointment_id) || [];
    entries.push({ itemId: movement.item_id, name: movement.inventory?.name || "Inventory item", amount: Number(movement.amount), unit: movement.inventory?.unit || "", batchNumber: movement.batch_number || "", date: movement.movement_date });
    stockByAppointment.set(movement.appointment_id, entries);
  });
  // Lead first, then the order they were assigned in, so the crew reads the
  // same way everywhere it is printed.
  const crewByAppointment = new Map();
  [...(crewResult.data || [])]
    .sort((a, b) => (b.is_lead ? 1 : 0) - (a.is_lead ? 1 : 0)
      || String(a.assigned_at || "").localeCompare(String(b.assigned_at || "")))
    .forEach((row) => {
      const entries = crewByAppointment.get(row.appointment_id) || [];
      entries.push(row.technician_id);
      crewByAppointment.set(row.appointment_id, entries);
    });

  const attachmentsByAppointment = new Map();
  (attachmentsResult.data || []).forEach((row) => {
    const entries = attachmentsByAppointment.get(row.appointment_id) || [];
    entries.push(mapAttachmentRow(row));
    attachmentsByAppointment.set(row.appointment_id, entries);
  });
  return {
    error: null,
    appointments: (appointmentsResult.data || []).map((row) => mapAppointmentRow({
      ...row,
      stockUsed: stockByAppointment.get(row.id) || [],
      attachments: attachmentsByAppointment.get(row.id) || [],
      technicianIds: crewByAppointment.get(row.id) || (row.technician_id ? [row.technician_id] : []),
    }, reports.get(row.id))),
  };
}

/**
 * `technicianIds` is ordered and the first entry leads. A single `technicianId`
 * is still accepted so callers that only ever assign one person do not have to
 * wrap it in an array.
 */
function crewFrom({ technicianIds, technicianId }) {
  const crew = (Array.isArray(technicianIds) ? technicianIds : [technicianId])
    .map((id) => id || "")
    .filter(Boolean);
  // Deduplicated in order: the same person picked twice is a slip, not a
  // booking with two of them on it.
  return Array.from(new Set(crew));
}

export async function createAppointment(fields) {
  const { clientId, scheduledAt, durationMinutes, pestConcern, serviceType, serviceLocation, notes, serviceFrequency, price } = fields;
  const crew = crewFrom(fields);
  const { data, error } = await supabase.rpc("create_appointment", {
    p_client_id: clientId,
    p_scheduled_at: new Date(scheduledAt).toISOString(),
    p_duration_minutes: Number(durationMinutes) || 60,
    p_pest_concern: pestConcern?.trim() || null,
    p_service_type: serviceType?.trim() || null,
    p_service_location: serviceLocation?.trim() || null,
    p_technician_ids: crew,
    p_notes: notes || null,
    p_service_frequency: serviceFrequency?.trim() || null,
    p_price: price === "" || price === undefined || price === null ? null : Number(price),
  });
  if (error) return { error: describeError(error) };
  // The RPC returns the appointments row, which carries only the lead. The crew
  // we just sent is authoritative, so it is attached rather than re-fetched.
  return { appointment: mapAppointmentRow({ ...(Array.isArray(data) ? data[0] : data), technicianIds: crew }) };
}

export async function updateAppointment(appointment) {
  const crew = crewFrom(appointment);
  const { data, error } = await supabase.rpc("update_appointment", {
    p_appointment_id: appointment.id,
    p_scheduled_at: new Date(appointment.scheduledAt).toISOString(),
    p_duration_minutes: Number(appointment.durationMinutes) || 60,
    p_pest_concern: appointment.pestConcern?.trim() || null,
    p_service_type: appointment.serviceType?.trim() || null,
    p_service_location: appointment.serviceLocation?.trim() || null,
    p_technician_ids: crew,
    p_status: appointment.status,
    p_notes: appointment.notes || null,
    p_cancellation_reason: appointment.cancellationReason?.trim() || null,
    p_service_frequency: appointment.serviceFrequency?.trim() || null,
    p_price: appointment.price === "" || appointment.price === undefined || appointment.price === null
      ? null
      : Number(appointment.price),
  });
  if (error) return { error: describeError(error) };
  return { appointment: mapAppointmentRow({ ...(Array.isArray(data) ? data[0] : data), technicianIds: crew }) };
}

/**
 * Uploads the customer's signature and returns its object key.
 *
 * Deliberately no appointment_report_attachments row: that table has no UPDATE
 * grant and technicians cannot delete, so a mis-signed signature filed there
 * could never be replaced. The key lives on appointment_reports instead, which
 * the report upsert can overwrite.
 */
export async function uploadSignature(appointmentId, file, kind = "customer") {
  const objectId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const prefix = kind === "technician" ? "technician-signature" : "signature";
  const storagePath = `${appointmentId}/${prefix}-${objectId}.png`;

  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, file, { contentType: "image/png", upsert: false });
  if (error) return { error: describeError(error) };

  return { storagePath };
}

/** Short-lived link for a stored signature, same contract as getAttachmentUrl. */
export async function getSignatureUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) return { error: describeError(error) };
  return { url: data.signedUrl };
}

export async function submitReport(appointmentId, { findings, treatmentPerformed, treatmentMethods, recommendations, followUpDate, customerName, signaturePath, completionNote, technicianSignaturePath }) {
  const { data, error } = await supabase.rpc("submit_appointment_report", {
    p_appointment_id: appointmentId,
    p_findings: findings,
    p_treatment_performed: treatmentPerformed,
    p_recommendations: recommendations || null,
    p_follow_up_date: followUpDate || null,
    p_customer_name: customerName || null,
    p_signature_path: signaturePath || null,
    p_completion_note: completionNote || null,
    p_treatment_methods: treatmentMethods || [],
    p_technician_signature_path: technicianSignaturePath || null,
  });
  if (error) return { error: describeError(error) };
  return { report: Array.isArray(data) ? data[0] : data };
}

// ---------------------------------------------------------------------------
// Report attachments (before/after photos, signed documents)
// ---------------------------------------------------------------------------

export function mapAttachmentRow(row) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    name: row.name,
    type: row.mime_type,
    size: row.size_bytes,
    storagePath: row.storage_path,
    category: row.category || "OTHER",
    uploadedAt: row.uploaded_at,
  };
}

/** Filenames become object keys, so strip anything that would break a path. */
function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/**
 * Bytes first, metadata row second — a failed upload leaves no row, so the UI
 * never lists an attachment whose file isn't there.
 */
export async function uploadAttachment(appointmentId, file, category = "OTHER") {
  const objectId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `${appointmentId}/${objectId}-${safeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) return { error: describeError(uploadError) };

  const { data, error } = await supabase
    .from("appointment_report_attachments")
    .insert({
      appointment_id: appointmentId,
      name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: storagePath,
      category,
    })
    .select(ATTACHMENT_COLUMNS)
    .single();

  if (error) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
    return { error: describeError(error) };
  }
  return { attachment: mapAttachmentRow(data) };
}

export async function deleteAttachment(attachment) {
  const { error } = await supabase.from("appointment_report_attachments").delete().eq("id", attachment.id);
  if (error) return { error: describeError(error) };

  const { error: storageError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storagePath]);
  if (storageError) console.warn("Attachment row deleted but file remains:", storageError);
  return { ok: true };
}

/** The bucket is private, so links are minted on click and expire quickly. */
export async function getAttachmentUrl(attachment, { download = false } = {}) {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL_SECONDS, {
      download: download ? attachment.name : undefined,
    });
  if (error) return { error: describeError(error) };
  return { url: data.signedUrl };
}

export async function stockOut(itemId, appointmentId, amount, date = new Date().toISOString().slice(0, 10)) {
  const { data, error } = await supabase.rpc("stock_out", {
    p_item_id: itemId,
    p_appointment_id: appointmentId,
    p_amount: Number(amount),
    p_movement_date: date,
  });
  if (error) return { error: describeError(error) };
  const row = Array.isArray(data) ? data[0] : data;
  return { movement: row, newQuantity: Number(row?.new_quantity) };
}

export async function stockOutBatch(appointmentId, items, date = new Date().toISOString().slice(0, 10)) {
  const { data, error } = await supabase.rpc("stock_out_batch", {
    p_appointment_id: appointmentId,
    p_items: items.map((item) => ({ item_id: item.itemId, amount: Number(item.amount), batch_number: item.batchNumber || null })),
    p_movement_date: date,
  });
  if (error) return { error: describeError(error) };
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return { movements: rows };
}
