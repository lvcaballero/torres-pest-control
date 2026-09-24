// The service catalog (migration 047): what the business sells, and the
// default materials each service uses. The appointment Stock-Out tab prefills
// from those materials; nothing here deducts stock.

import { supabase } from "./supabaseClient";

const SERVICE_COLUMNS =
  "id, name, description, default_price, default_duration_minutes, sort_order, is_active, created_at, updated_at, service_materials(item_id, default_amount)";

export function describeError(error) {
  if (!error) return "Unknown error";
  return [error.message || "Unknown error", error.details ? ` - ${error.details}` : "", error.hint ? ` (hint: ${error.hint})` : ""].join("");
}

// The unique index is on lower(trim(name)); Postgres reports it by index name,
// which means nothing to the person who typed the name.
function friendlyError(error) {
  const message = describeError(error);
  if (/services_name_unique_idx/i.test(message)) return "A service with that name already exists.";
  return message;
}

const numberOrNull = (value) => (value === null || value === undefined || value === "" ? null : Number(value));

export function mapServiceRow(row) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    defaultPrice: numberOrNull(row.default_price),
    defaultDurationMinutes: numberOrNull(row.default_duration_minutes),
    sortOrder: Number(row.sort_order) || 0,
    isActive: row.is_active !== false,
    materials: (row.service_materials || []).map((material) => ({
      itemId: material.item_id,
      defaultAmount: Number(material.default_amount),
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toServiceRow({ name, description, defaultPrice, defaultDurationMinutes, sortOrder, isActive }) {
  const row = {};
  if (name !== undefined) row.name = String(name).trim();
  if (description !== undefined) row.description = String(description || "").trim() || null;
  if (defaultPrice !== undefined) row.default_price = numberOrNull(defaultPrice);
  if (defaultDurationMinutes !== undefined) row.default_duration_minutes = numberOrNull(defaultDurationMinutes);
  if (sortOrder !== undefined) row.sort_order = Number(sortOrder) || 0;
  if (isActive !== undefined) row.is_active = Boolean(isActive);
  return row;
}

/** Every service, retired ones included; callers filter for the booking form. */
export async function fetchServices() {
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { error: describeError(error), services: [] };
  return { error: null, services: (data || []).map(mapServiceRow) };
}

export async function createService(fields) {
  const { data, error } = await supabase
    .from("services")
    .insert(toServiceRow(fields))
    .select(SERVICE_COLUMNS)
    .single();
  if (error) return { error: friendlyError(error) };
  return { error: null, service: mapServiceRow(data) };
}

export async function updateService(id, fields) {
  const { data, error } = await supabase
    .from("services")
    .update(toServiceRow(fields))
    .eq("id", id)
    .select(SERVICE_COLUMNS)
    .single();
  if (error) return { error: friendlyError(error) };
  return { error: null, service: mapServiceRow(data) };
}

/** Retire or restore. Booked appointments are untouched either way. */
export async function setServiceActive(id, isActive) {
  return updateService(id, { isActive });
}

/**
 * Permanently delete a service and its materials list. Appointments booked
 * under it keep their service name (appointments.service_type); only the
 * service_id link is cleared, by the foreign key's `on delete set null`.
 */
export async function deleteService(id) {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return { error: describeError(error) };
  return { error: null };
}

/** Replace a service's materials list in one transaction. */
export async function saveServiceMaterials(serviceId, materials) {
  const { error } = await supabase.rpc("set_service_materials", {
    p_service_id: serviceId,
    p_materials: (materials || []).map((material) => ({
      item_id: material.itemId,
      default_amount: Number(material.defaultAmount),
    })),
  });
  if (error) return { error: describeError(error) };
  return { error: null };
}
