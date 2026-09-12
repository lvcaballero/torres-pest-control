// All account reads/writes.
//
// Previously, accounts were split across three Supabase tables (admins /
// staff / technicians) with role implied by which table a row lived in.
// schema-v2.sql collapsed that into a single `users` table with a `role`
// column, and locked direct writes to it entirely — every create/edit/
// status-change now has to go through a SECURITY DEFINER RPC
// (create_user / update_user / set_user_status). Those RPCs are also where
// the "only one Admin, can't create more Admins, Admins can't touch other
// Admins" rules actually live, so routing through them (instead of writing
// straight to the table) is what makes those rules apply at all.

import { supabase } from "./supabaseClient";
import { ACCOUNT_STATUS, ROLES } from "../utils/constants";

const ACCOUNT_COLUMNS = "id, name, username, phone, email, role, status, is_primary, created_at, updated_at, last_login_at";

export function mapAccountRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    username: row.username || row.email,
    role: row.role,
    status: row.status,
    isPrimary: row.is_primary || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || null,
  };
}

function describeError(error) {
  if (!error) return "Unknown error";
  return [
    error.message || "Unknown error",
    error.details ? ` — ${error.details}` : "",
    error.hint ? ` (hint: ${error.hint})` : "",
    error.code ? ` [code: ${error.code}]` : "",
  ].join("");
}

/** Loads every account from the unified users table. Admins are hidden from
 * non-admin callers server-side (RLS), not here — this just reflects
 * whatever rows come back. */
export async function fetchAllAccounts() {
  const { data, error } = await supabase
    .from("users")
    .select(ACCOUNT_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) return { error: describeError(error), admins: [], staff: [], technicians: [] };

  const accounts = (data || []).map(mapAccountRow);
  return {
    error: null,
    admins: accounts.filter((account) => account.role === ROLES.ADMIN),
    staff: accounts.filter((account) => account.role === ROLES.STAFF),
    technicians: accounts.filter((account) => account.role === ROLES.TECHNICIAN),
  };
}

/**
 * Returns { account } on success, { error } on failure.
 *
 * create_user() itself refuses `new_role: 'ADMIN'` — that's the "no new
 * Admins" rule. It surfaces as a normal RPC error here, same as a duplicate
 * email would.
 */
export async function createAccount(sessionToken, role, fields) {
  const { data, error } = await supabase.rpc("create_user", {
    session_token: sessionToken,
    new_name: fields.name,
    new_username: fields.username || fields.email,
    new_email: fields.email,
    new_phone: fields.phone || null,
    new_password: fields.password,
    new_role: role,
  });

  if (error) return { error: describeError(error) };
  return { account: mapAccountRow(data) };
}

/**
 * Updates an existing account's name/email/phone (and role, though
 * update_user() refuses any change into or out of ADMIN — that's the
 * "Admins can't be created or demoted" rule, and it applies here the same
 * way it applies to createAccount's role restriction).
 *
 * Username isn't editable post-creation: update_user() doesn't take a
 * username parameter. That's a real, current limitation of the schema, not
 * an oversight in this file — flag it if the team wants that added.
 */
export async function updateAccount(sessionToken, account, updatedFields) {
  const { data, error } = await supabase.rpc("update_user", {
    session_token: sessionToken,
    target_id: account.id,
    new_name: updatedFields.name,
    new_email: updatedFields.email,
    new_phone: updatedFields.phone,
    new_role: updatedFields.role || account.role,
  });

  if (error) return { error: describeError(error) };
  const mapped = mapAccountRow(data);
  return { account: mapped, updatedAt: data.updated_at };
}

/**
 * Flips ACTIVE <-> INACTIVE via set_user_status().
 *
 * This RPC is also where "can't deactivate the last active Admin" and
 * "Admins can't deactivate other Admins" are enforced server-side — this
 * file used to duplicate the last-admin check client-side (see
 * isLastActiveAdmin below, kept for an instant UI message), but the real
 * guard is here now, in the database, where it can't be bypassed by a
 * direct table write anymore.
 */
export async function setAccountStatus(sessionToken, account, nextStatus) {
  const { data, error } = await supabase.rpc("set_user_status", {
    session_token: sessionToken,
    target_id: account.id,
    new_status: nextStatus,
  });

  if (error) return { error: describeError(error) };
  return { account: mapAccountRow(data), updatedAt: data.updated_at };
}

/** Admin-initiated password reset, and the write half of a self-service change. */
export async function changePassword(sessionToken, currentPassword, newPassword) {
  if (!sessionToken) return { error: "Your session is outdated. Please sign in again before changing your password." };

  const { error } = await supabase.rpc("change_password", {
    session_token: sessionToken,
    current_password: currentPassword,
    new_password: newPassword,
  });
  if (error) return { error: describeError(error) };
  return { ok: true };
}

export async function resetPassword(sessionToken, targetId, newPassword) {
  const { error } = await supabase.rpc("reset_password", {
    session_token: sessionToken,
    target_id: targetId,
    new_password: newPassword,
  });
  if (error) return { error: describeError(error) };
  return { ok: true };
}

/**
 * Client-side guard kept only so the UI can show an instant message before
 * round-tripping to the server. set_user_status() enforces the same rule
 * authoritatively — this can go stale (e.g. another tab deactivated an
 * admin a second ago) and the RPC's rejection is still the real backstop.
 */
export function isLastActiveAdmin(account, accounts) {
  if (account.role !== ROLES.ADMIN) return false;
  const activeAdmins = accounts.filter(
    (entry) => entry.role === ROLES.ADMIN && entry.status === ACCOUNT_STATUS.ACTIVE
  );
  return activeAdmins.length <= 1;
}
