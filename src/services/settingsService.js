// CRUD operations for the admin-managed treatment_methods table.

import { supabase } from "./supabaseClient";

function describeError(error) {
  if (!error) return "Unknown error";
  return [error.message || "Unknown error", error.details ? ` - ${error.details}` : "", error.hint ? ` (hint: ${error.hint})` : ""].join("");
}

/** Fetch all active treatment methods, ordered by group then sort_order. */
export async function fetchTreatmentMethods() {
  const { data, error } = await supabase
    .from("treatment_methods")
    .select("id, group_name, value, label, sort_order, is_active")
    .eq("is_active", true)
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return { error: describeError(error), methods: [] };
  return { error: null, methods: data || [] };
}

/** Fetch ALL treatment methods (including inactive) for admin management. */
export async function fetchAllTreatmentMethods() {
  const { data, error } = await supabase
    .from("treatment_methods")
    .select("id, group_name, value, label, sort_order, is_active")
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return { error: describeError(error), methods: [] };
  return { error: null, methods: data || [] };
}

/** Add a new treatment method. */
export async function addTreatmentMethod({ groupName, value, label, sortOrder = 0 }) {
  const { data, error } = await supabase
    .from("treatment_methods")
    .insert({ group_name: groupName, value, label, sort_order: sortOrder })
    .select("id, group_name, value, label, sort_order, is_active")
    .single();
  if (error) return { error: describeError(error) };
  return { error: null, method: data };
}

/** Update an existing treatment method. */
export async function updateTreatmentMethod(id, { groupName, value, label, sortOrder, isActive }) {
  const updates = {};
  if (groupName !== undefined) updates.group_name = groupName;
  if (value !== undefined) updates.value = value;
  if (label !== undefined) updates.label = label;
  if (sortOrder !== undefined) updates.sort_order = sortOrder;
  if (isActive !== undefined) updates.is_active = isActive;

  const { data, error } = await supabase
    .from("treatment_methods")
    .update(updates)
    .eq("id", id)
    .select("id, group_name, value, label, sort_order, is_active")
    .single();
  if (error) return { error: describeError(error) };
  return { error: null, method: data };
}

/**
 * Permanently delete a treatment method.
 *
 * The database refuses this when the method is already recorded on a filed
 * report, because reports store the `value` string rather than a row id and
 * deleting it would change what an existing report says. Retire it with
 * setTreatmentMethodActive(id, false) instead — the caller is told which case
 * it hit via `inUse`.
 */
export async function deleteTreatmentMethod(id) {
  const { error } = await supabase
    .from("treatment_methods")
    .delete()
    .eq("id", id);
  if (error) {
    const message = describeError(error);
    return { error: message, inUse: /already recorded on filed reports/i.test(message) };
  }
  return { error: null, inUse: false };
}

/** Retire or restore a method without touching reports that reference it. */
export async function setTreatmentMethodActive(id, isActive) {
  return updateTreatmentMethod(id, { isActive });
}

