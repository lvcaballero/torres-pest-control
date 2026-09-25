// Login / logout / session persistence.
//
// Supabase Auth is deliberately not used — see the header comment in
// supabase/schema.sql. Credentials are checked by this project's own
// check_login() SQL function against the admins/staff/technicians tables.

import { supabase } from "./supabaseClient";
import { STORAGE_KEYS } from "../utils/constants";

function describeLoginError(error) {
  // The full error goes to the console for whoever is debugging; the person
  // at the sign-in form gets a message that names no table, code or file.
  if (error) console.error("check_login failed:", error);
  return "Can't reach the sign-in service. Try again in a moment, or contact your administrator.";
}

async function checkLogin(email, password) {
  const v2Response = await supabase.rpc("check_login", {
    login_identifier: email,
    login_password: password,
  });

  // Only fall back to the old v1 parameter names when PostgREST itself says
  // the v2 signature doesn't exist in the schema cache (PGRST202).
  // Do NOT fall back on 42883 — that is a Postgres-level error that can come
  // from *inside* the function (e.g. missing pgcrypto extension), and
  // retrying with different param names won't help.
  if (!v2Response.error || v2Response.error.code !== "PGRST202") {
    return v2Response;
  }

  return supabase.rpc("check_login", {
    login_email: email,
    login_password: password,
  });
}

/**
 * Sprint AC (Login): "System validates credentials and denies access if
 * incorrect" and "Failed login attempts show an error message without
 * revealing which field was incorrect."
 *
 * Both the no-match case and the backend-error case return the same generic
 * string. The old code returned error.message straight from Postgres, which
 * leaked backend detail into the login form.
 *
 * @returns {{ session?: {id, role}, profile?: object, error?: string }}
 */
export async function login(email, password) {
  const { data, error } = await checkLogin(email, password);

  if (error) return { error: describeLoginError(error) };

  const match = (data || [])[0];
  if (!match) return { error: "Invalid email or password." };
  if (!match.token) {
    // An old check_login() that issues no session token (pre migration 008).
    console.error("check_login returned no session token; apply schema-v2.sql and migration 008.");
    return { error: describeLoginError(null) };
  }

  return {
    session: { token: match.token, id: match.id, role: match.role },
    profile: match,
  };
}

/**
 * Request a temporary password by email (the "Forgot password?" flow).
 * Always resolves to a generic success message regardless of whether the
 * email matched an account — the Edge Function is deliberately silent about
 * that so the endpoint can't be used to enumerate registered emails.
 *
 * Requires the `forgot-password` Edge Function to be deployed with a
 * RESEND_API_KEY secret set. If it isn't deployed yet, this call fails and
 * the caller should show a fallback message pointing people to an admin.
 */
export async function requestPasswordReset(email) {
  if (!supabase) return { error: "Supabase is not configured." };

  const { data, error } = await supabase.functions.invoke("forgot-password", {
    body: { email },
  });

  if (error) {
    console.error("requestPasswordReset error:", error);
    return { error: "Couldn't reach the password reset service. Please ask an administrator to reset your password instead." };
  }

  return { message: data?.message || "If an account exists for that email, we've sent a temporary password to it." };
}

/** Validate the opaque session issued by check_login(). */
export async function validateSession(token) {
  if (!token) return { error: "Session expired." };

  const { data, error } = await supabase.rpc("validate_session", { session_token: token });
  if (error) return { error: "Session expired." };

  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile || profile.status !== "ACTIVE") return { error: "Session expired." };
  return { profile };
}

export async function logout(token) {
  if (!token) return;
  await supabase.rpc("logout", { session_token: token });
}

/**
 * The session lives in localStorage when the user ticked "keep me signed
 * in", and in sessionStorage otherwise — so on a shared PC it dies with the
 * browser window. Reading checks both.
 */
export function loadSession() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const saved = store.getItem(STORAGE_KEYS.SESSION);
      if (saved) return JSON.parse(saved);
    } catch {
      // Unreadable or blocked storage: try the next one.
    }
  }
  return null;
}

export function saveSession(session) {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    if (session) {
      const store = session.remember === false ? sessionStorage : localStorage;
      store.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    }
  } catch {
    // Storage blocked (private mode): the session lasts for this page only.
  }
}

/**
 * Verifies a stored password before allowing a self-service change.
 * Sprint AC (Change Password): "entering current and new password".
 *
 * Reuses check_login because the password column is not readable directly —
 * column-level grants hide it from ordinary selects.
 */
export async function verifyPassword(email, password) {
  const { data, error } = await checkLogin(email, password);

  if (error) return false;
  return (data || []).length > 0;
}
