// Inventory items — chemicals, equipment, and materials.
//
// Backed by the Supabase `inventory` table. It was previously localStorage,
// not by design but by accident: the table existed since v1, but v1 enabled
// RLS on it without writing a policy, so every request was denied and the app
// fell back to the browser. Items added in the UI never reached Postgres.
//
// Run supabase/migrations/003-inventory.sql before using this.
//
// One table holds three sub-types. `type` selects which block of columns
// applies; the rest stay null.

import { supabase } from "./supabaseClient";

export const INVENTORY_STATUS = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
};

const COLUMNS = `
  id, name, type, quantity, unit, cost, supplier, storage_location, reorder_level, status,
  purchase_unit, usage_unit, conversion_multiplier, created_by, intake_branch_or_station,
  created_at, updated_at,
  chemical_type, expiration_date, safety_level, hazard_rating, date_received,
  serial_number, condition, last_maintenance_date, next_maintenance_date, manufacturer, model,
  material_category, description
`;

const MOVEMENT_COLUMNS = `
  id, item_id, amount, quantity_delta, movement_date, reference, actor, intake_branch_or_station, movement_type, appointment_id, unit_cost, total_cost, created_at,
  entered_amount, entered_unit, conversion_factor, stock_out_reason, technician_id, note,
  inventory ( name, unit, cost )
`;

function describeError(error) {
  if (!error) return "Unknown error";
  return [
    error.message || "Unknown error",
    error.details ? ` — ${error.details}` : "",
    error.hint ? ` (hint: ${error.hint})` : "",
  ].join("");
}

// ---------------------------------------------------------------------------
// Row <-> app shape
//
// The UI uses camelCase throughout; the table uses snake_case.
// ---------------------------------------------------------------------------

export function mapInventoryRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    quantity: Number(row.quantity),
    unit: row.unit,
    purchaseUnit: row.purchase_unit || row.unit,
    usageUnit: row.usage_unit || row.unit,
    conversionMultiplier: row.conversion_multiplier === null ? 1 : Number(row.conversion_multiplier),
    cost: Number(row.cost),
    supplier: row.supplier || "",
    storageLocation: row.storage_location || "",
    reorderLevel: row.reorder_level === null ? null : Number(row.reorder_level),
    status: row.status || INVENTORY_STATUS.ACTIVE,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    chemicalType: row.chemical_type,
    expirationDate: row.expiration_date,
    safetyLevel: row.safety_level,
    hazardRating: row.hazard_rating,
    dateReceived: row.date_received,

    serialNumber: row.serial_number,
    condition: row.condition,
    lastMaintenanceDate: row.last_maintenance_date,
    nextMaintenanceDate: row.next_maintenance_date,
    manufacturer: row.manufacturer,
    model: row.model,

    materialCategory: row.material_category,
    description: row.description,
    createdBy: row.created_by,
    intakeBranchOrStation: row.intake_branch_or_station || "",
  };
}

/** Empty strings must become null — Postgres enums and timestamps reject "". */
const nullIfBlank = (value) =>
  value === undefined || value === null || value === "" ? null : value;

const normalizeIdentityValue = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function hasDuplicateInventoryItem(item, inventory) {
  const matches = (existing, field) => normalizeIdentityValue(existing[field]) === normalizeIdentityValue(item[field]);
  const sharedMatch = (existing) =>
    matches(existing, "name") && matches(existing, "type") && matches(existing, "unit");

  return (inventory || []).some((existing) => {
    if (!sharedMatch(existing) || existing.id === item.id) return false;
    if (item.type === "CHEMICAL") {
      return matches(existing, "chemicalType") && matches(existing, "safetyLevel") && matches(existing, "hazardRating");
    }
    if (item.type === "EQUIPMENT") {
      return matches(existing, "manufacturer") && matches(existing, "model") && matches(existing, "serialNumber");
    }
    return matches(existing, "materialCategory");
  });
}

// Quantity is intentionally absent here. It's no longer settable through
// the Item Profile form — new items start at 0 (the column default), and
// after that the only path that can change it is stock_in() below. That
// keeps quantity impossible to desync from the movement log: there's no
// form field left that could set it directly.
function buildPayload(item) {
  const payload = {
    name: item.name?.trim(),
    type: item.type,
    unit: item.unit,
    cost: Number(item.cost) || 0,
    supplier: nullIfBlank(item.supplier),
    storage_location: nullIfBlank(item.storageLocation),
    reorder_level: item.reorderLevel === null || item.reorderLevel === "" ? null : Number(item.reorderLevel),
    intake_branch_or_station: nullIfBlank(item.intakeBranchOrStation),
  };

  // Only send the block that matches the type, so switching type doesn't leave
  // stale values from another sub-type behind.
  if (item.type === "CHEMICAL") {
    payload.chemical_type = nullIfBlank(item.chemicalType);
    payload.expiration_date = nullIfBlank(item.expirationDate);
    payload.safety_level = nullIfBlank(item.safetyLevel);
    payload.hazard_rating = nullIfBlank(item.hazardRating);
    payload.date_received = nullIfBlank(item.dateReceived);
  } else if (item.type === "EQUIPMENT") {
    payload.serial_number = nullIfBlank(item.serialNumber);
    payload.condition = nullIfBlank(item.condition);
    payload.last_maintenance_date = nullIfBlank(item.lastMaintenanceDate);
    payload.next_maintenance_date = nullIfBlank(item.nextMaintenanceDate);
    payload.manufacturer = nullIfBlank(item.manufacturer);
    payload.model = nullIfBlank(item.model);
  } else if (item.type === "MATERIAL") {
    payload.material_category = nullIfBlank(item.materialCategory);
    payload.description = nullIfBlank(item.description);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function fetchInventory() {
  const { data, error } = await supabase
    .from("inventory")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return { error: describeError(error), inventory: [] };
  return { error: null, inventory: (data || []).map(mapInventoryRow) };
}

export async function createItem(item, actorId, inventory) {
  const { data: currentRows, error: inventoryError } = await supabase
    .from("inventory")
    .select(COLUMNS);

  if (inventoryError) return { error: describeError(inventoryError) };

  const currentInventory = (currentRows || []).map(mapInventoryRow);
  if (hasDuplicateInventoryItem(item, currentInventory) || hasDuplicateInventoryItem(item, inventory)) {
    return { error: "This item already exists. Use Stock In to add quantity instead." };
  }

  const { data, error } = await supabase
    .from("inventory")
    // Quantity starts at zero by design. It is never supplied by the form;
    // Stock In is the only user-facing operation that can increase it.
    .insert({ ...buildPayload(item), quantity: 0, created_by: actorId || null })
    .select(COLUMNS)
    .single();

  if (error) return { error: describeError(error) };
  return { item: mapInventoryRow(data) };
}

export async function updateItem(itemId, item, inventory) {
  const { data: currentRows, error: inventoryError } = await supabase
    .from("inventory")
    .select(COLUMNS);

  if (inventoryError) return { error: describeError(inventoryError) };

  const currentInventory = (currentRows || []).map(mapInventoryRow);
  if (hasDuplicateInventoryItem({ ...item, id: itemId }, currentInventory) || hasDuplicateInventoryItem({ ...item, id: itemId }, inventory)) {
    return { error: "Another item with the same identity already exists." };
  }

  const { data, error } = await supabase
    .from("inventory")
    .update(buildPayload(item))
    .eq("id", itemId)
    .select(COLUMNS)
    .single();

  if (error) return { error: describeError(error) };
  return { item: mapInventoryRow(data) };
}

export async function deleteItem(itemId) {
  const { error } = await supabase.from("inventory").delete().eq("id", itemId);
  if (error) return { error: describeError(error) };
  return { ok: true };
}

/**
 * Edit only ever pre-fills and writes Name / Type / Unit — that's the only
 * data it's designed to change. A dedicated payload (rather than reusing
 * buildPayload with a half-filled `item`) so it never touches Supplier,
 * Reorder Level, or the type-specific columns it doesn't show.
 */
export async function updateItemBasics(itemId, { name, type, unit }) {
  const { data, error } = await supabase
    .from("inventory")
    .update({ name: name?.trim(), type, unit })
    .eq("id", itemId)
    .select(COLUMNS)
    .single();

  if (error) return { error: describeError(error) };
  return { item: mapInventoryRow(data) };
}

export async function setItemStatus(itemId, status) {
  const { data, error } = await supabase
    .from("inventory")
    .update({ status })
    .eq("id", itemId)
    .select(COLUMNS)
    .single();

  if (error) return { error: describeError(error) };
  return { item: mapInventoryRow(data) };
}

/**
 * A whole delivery in one server-side transaction (stock_in_batch(), migration
 * 040). Either every line lands or none does, so a delivery note and the stock
 * levels can never end up half-agreeing.
 *
 * `entries` carry `amount` already converted into the item's own unit — see
 * utils/units.js. The pre-conversion figures ride along so the movement log can
 * show what was actually written on the note.
 */
export async function stockInBatch(entries, { date, reference, intakeBranchOrStation, idempotencyKey }) {
  const { data, error } = await supabase.rpc("stock_in_batch", {
    p_items: entries.map((entry) => ({
      item_id: entry.itemId,
      amount: Number(entry.amount),
      unit_cost: entry.unitCost === "" || entry.unitCost === undefined || entry.unitCost === null
        ? null
        : Number(entry.unitCost),
      entered_amount: entry.enteredAmount === "" || entry.enteredAmount === undefined || entry.enteredAmount === null
        ? null
        : Number(entry.enteredAmount),
      entered_unit: entry.enteredUnit || null,
      conversion_factor: entry.conversionFactor === undefined || entry.conversionFactor === null
        ? 1
        : Number(entry.conversionFactor),
    })),
    p_movement_date: date,
    p_reference: nullIfBlank(reference),
    p_intake_branch_or_station: nullIfBlank(intakeBranchOrStation),
    p_idempotency_key: idempotencyKey || null,
  });

  if (error) return { error: describeError(error) };
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) return { error: "Stock In did not return a saved movement." };

  return {
    movements: rows.map((row) => ({
      id: row.movement_id,
      itemId: row.item_id,
      amount: Number(row.amount),
      quantityDelta: Number(row.amount),
      movementDate: row.movement_date,
      reference: row.reference || reference || "",
      actor: row.actor || "",
      movementType: "IN",
      intakeBranchOrStation: intakeBranchOrStation || "",
      unitCost: Number(row.unit_cost) || 0,
      totalCost: Number(row.total_cost) || 0,
      createdAt: row.created_at,
      newQuantity: Number(row.new_quantity),
    })),
  };
}

/**
 * Stock leaving for a reason that is not an appointment: checked out to a
 * technician, missing at count, or damaged. The date is the caller's, not the
 * server's — a shortfall found today is often a shortfall from last week.
 */
export async function stockOutManual(itemId, { amount, date, reason, technicianId, note }) {
  const { data, error } = await supabase.rpc("stock_out_manual", {
    p_item_id: itemId,
    p_amount: Number(amount),
    p_movement_date: date,
    p_reason: reason,
    p_technician_id: reason === "TECHNICIAN_CHECKOUT" ? technicianId || null : null,
    p_note: nullIfBlank(note),
  });

  if (error) return { error: describeError(error) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "Stock Out did not return a saved movement." };

  return {
    movement: {
      id: row.movement_id,
      itemId: row.item_id,
      amount: Number(row.amount),
      quantityDelta: -Number(row.amount),
      movementDate: row.movement_date,
      stockOutReason: row.reason,
      technicianId: row.technician_id || "",
      note: row.note || "",
      actor: row.actor || "",
      movementType: "OUT",
    },
    newQuantity: Number(row.new_quantity),
  };
}

export async function stockCorrection(itemId, delta, reason, date = new Date().toISOString().slice(0, 10)) {
  const { data, error } = await supabase.rpc("stock_correction", {
    p_item_id: itemId,
    p_delta: Number(delta),
    p_reason: reason,
    p_movement_date: date,
  });
  if (error) return { error: describeError(error) };
  const row = Array.isArray(data) ? data[0] : data;
  return { movement: row, newQuantity: Number(row?.new_quantity) };
}

function mapMovementRow(row) {
  const amount = Number(row.amount) || 0;
  const unitCost = Number(row.unit_cost) || Number(row.inventory?.cost) || 0;
  const totalCost = Number(row.total_cost) || (amount * unitCost);

  return {
    id: row.id,
    itemId: row.item_id,
    amount,
    movementDate: row.movement_date,
    reference: row.reference || row.purchase_reference || "—",
    intakeBranchOrStation: row.intake_branch_or_station || "—",
    movementType: row.movement_type || "IN",
    enteredAmount: row.entered_amount === null || row.entered_amount === undefined ? null : Number(row.entered_amount),
    enteredUnit: row.entered_unit || "",
    conversionFactor: row.conversion_factor === null || row.conversion_factor === undefined ? 1 : Number(row.conversion_factor),
    stockOutReason: row.stock_out_reason || "",
    technicianId: row.technician_id || "",
    note: row.note || "",
    quantityDelta: row.quantity_delta === null || row.quantity_delta === undefined ? (row.movement_type === "OUT" ? -Number(row.amount) : Number(row.amount)) : Number(row.quantity_delta),
    appointmentId: row.appointment_id || null,
    actor: row.actor || "—",
    unitCost,
    totalCost,
    createdAt: row.created_at,
    itemName: row.inventory?.name || "Unknown item",
    itemUnit: row.inventory?.unit || "",
  };
}

export async function fetchMovements() {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(MOVEMENT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return { error: describeError(error), movements: [] };
  return { error: null, movements: (data || []).map(mapMovementRow) };
}

/** Drives the low-stock badge. */
export function isLowStock(item) {
  if (item?.reorderLevel === undefined || item?.reorderLevel === null) return false;
  return Number(item.quantity) <= Number(item.reorderLevel);
}
