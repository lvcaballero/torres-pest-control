import { supabase } from "./supabaseClient";

const APPOINTMENT_COLUMNS = "id, client_id, scheduled_at, duration_minutes, pest_concern, technician_id, status, notes, created_by, created_at, updated_at";
const REPORT_COLUMNS = "appointment_id, findings, submitted_by, submitted_at";

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
    technicianId: row.technician_id || "",
    status: row.status,
    notes: row.notes || "",
    report: report?.findings || "",
    reportSubmitted: Boolean(report),
    stockUsed: row.stockUsed || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAppointments() {
  const [appointmentsResult, reportsResult, stockResult] = await Promise.all([
    supabase.from("appointments").select(APPOINTMENT_COLUMNS).order("scheduled_at", { ascending: true }),
    supabase.from("appointment_reports").select(REPORT_COLUMNS),
    supabase.from("inventory_movements").select("item_id, appointment_id, amount, movement_date, inventory(name, unit)").eq("movement_type", "OUT").not("appointment_id", "is", null),
  ]);
  const error = appointmentsResult.error || reportsResult.error || stockResult.error;
  if (error) return { error: describeError(error), appointments: [] };
  const reports = new Map((reportsResult.data || []).map((report) => [report.appointment_id, report]));
  const stockByAppointment = new Map();
  (stockResult.data || []).forEach((movement) => {
    const entries = stockByAppointment.get(movement.appointment_id) || [];
    entries.push({ itemId: movement.item_id, name: movement.inventory?.name || "Inventory item", amount: Number(movement.amount), unit: movement.inventory?.unit || "", date: movement.movement_date });
    stockByAppointment.set(movement.appointment_id, entries);
  });
  return { error: null, appointments: (appointmentsResult.data || []).map((row) => mapAppointmentRow({ ...row, stockUsed: stockByAppointment.get(row.id) || [] }, reports.get(row.id))) };
}

export async function createAppointment({ clientId, scheduledAt, durationMinutes, pestConcern, technicianId, notes }) {
  const { data, error } = await supabase.rpc("create_appointment", {
    p_client_id: clientId,
    p_scheduled_at: new Date(scheduledAt).toISOString(),
    p_duration_minutes: Number(durationMinutes) || 60,
    p_pest_concern: pestConcern?.trim() || null,
    p_technician_id: technicianId || null,
    p_notes: notes || null,
  });
  if (error) return { error: describeError(error) };
  return { appointment: mapAppointmentRow(Array.isArray(data) ? data[0] : data) };
}

export async function updateAppointment(appointment) {
  const { data, error } = await supabase.rpc("update_appointment", {
    p_appointment_id: appointment.id,
    p_scheduled_at: new Date(appointment.scheduledAt).toISOString(),
    p_duration_minutes: Number(appointment.durationMinutes) || 60,
    p_pest_concern: appointment.pestConcern?.trim() || null,
    p_technician_id: appointment.technicianId || null,
    p_status: appointment.status,
    p_notes: appointment.notes || null,
  });
  if (error) return { error: describeError(error) };
  return { appointment: mapAppointmentRow(Array.isArray(data) ? data[0] : data) };
}

export async function submitReport(appointmentId, findings) {
  const { data, error } = await supabase.rpc("submit_appointment_report", {
    p_appointment_id: appointmentId,
    p_findings: findings,
  });
  if (error) return { error: describeError(error) };
  return { report: Array.isArray(data) ? data[0] : data };
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
    p_items: items.map((item) => ({ item_id: item.itemId, amount: Number(item.amount) })),
    p_movement_date: date,
  });
  if (error) return { error: describeError(error) };
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return { movements: rows };
}
