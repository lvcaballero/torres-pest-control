// Forgot Password — Edge Function
// ============================================================================
// POST { email: string }
// Always responds with the same generic message whether or not the email
// matches an account, so this endpoint can't be used to check who has an
// account (user enumeration).
//
// Flow:
//   1. Call request_password_reset(email) using the SERVICE ROLE key. That
//      RPC is locked down (see migration 016) so only this function — never
//      the browser — can call it, because it returns a plaintext temp
//      password.
//   2. If a matching account was found, email that temp password via Resend.
//   3. Respond generically either way.
//
// Setup required before this works (see the README section below):
//   supabase secrets set RESEND_API_KEY=your_resend_api_key
//   supabase functions deploy forgot-password --no-verify-jwt
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Supabase Edge Runtime — you don't set those yourself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENERIC_MESSAGE =
  "If an account exists for that email, we've sent a temporary password to it.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabaseAdmin
      .rpc("request_password_reset", { target_email: email.trim() })
      .maybeSingle();

    // Log server-side for debugging, but never leak DB errors to the client.
    if (error) {
      console.error("request_password_reset failed:", error);
      return new Response(JSON.stringify({ message: GENERIC_MESSAGE }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No matching account — data is null. Respond the same as success.
    if (!data) {
      return new Response(JSON.stringify({ message: GENERIC_MESSAGE }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set — cannot send email.");
      return new Response(JSON.stringify({ message: GENERIC_MESSAGE }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Resend's free tier only lets you send from their shared
        // "onboarding@resend.dev" address until you verify your own domain.
        // Swap this once a domain is verified in the Resend dashboard.
        from: "Torres Pest Control <onboarding@resend.dev>",
        to: [data.user_email],
        subject: "Your temporary password — Torres Pest Control",
        html: `
          <p>Hi ${data.user_name},</p>
          <p>Here's a temporary password to get back into your account:</p>
          <p style="font-size: 1.25rem; font-weight: 700; letter-spacing: 0.05em;">
            ${data.temp_password}
          </p>
          <p>Log in with it, then go to <strong>Settings &gt; Change Password</strong>
          to set a password only you know. This temporary password only works
          for one login.</p>
          <p>If you didn't request this, contact an administrator — someone
          else may be trying to access your account.</p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      console.error("Resend send failed:", emailResponse.status, detail);
      // The temp password was already written to the DB even though the
      // email failed. Don't leave the account silently changed with no way
      // for the user to find out — but still don't leak details to the
      // client.
    }

    return new Response(JSON.stringify({ message: GENERIC_MESSAGE }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("forgot-password error:", err);
    return new Response(JSON.stringify({ message: GENERIC_MESSAGE }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
