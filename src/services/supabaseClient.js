import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
const hasPlaceholder = (value) => !value || value.includes("your-");

export const isSupabaseConfigured = !hasPlaceholder(supabaseUrl) && !hasPlaceholder(supabaseKey);
export let supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

export function setSupabaseSessionToken(token) {
  if (!isSupabaseConfigured) return;
  
  if (token) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          'x-session-token': token,
        },
      },
    });
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
}
