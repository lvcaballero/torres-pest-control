// "Forgot password?" form. Collects an email, asks the backend to email a
// temp password, and always shows the same success message — see
// authService.requestPasswordReset for why.

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "../../services/authService";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter the email on your account.");
      return;
    }
    setError("");
    setMessage("");
    setSubmitting(true);
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);

    if (result.error) setError(result.error);
    else setMessage(result.message);
  };

  const backLink = (
    <p className="auth-note">
      <Link className="auth-link" to="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
        Back to sign in
      </Link>
    </p>
  );

  return (
    <section aria-labelledby="reset-title">
      <p className="auth-eyebrow">Password help</p>
      <h1 id="reset-title">Forgot password</h1>
      <p className="auth-lede">
        {message
          ? "Check your inbox."
          : "Enter your account email and we'll send a temporary password you can sign in with."}
      </p>

      {message ? (
        <>
          <p className="auth-status" role="status">
            {message}
          </p>
          {backLink}
        </>
      ) : (
        <form noValidate onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="reset-email">
            Email address
          </label>
          <input
            id="reset-email"
            name="email"
            className="auth-input"
            type="email"
            autoComplete="email"
            placeholder="jun@torres.ph"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError("");
            }}
            aria-invalid={Boolean(error)}
            autoFocus
            style={{ marginBottom: "20px" }}
          />

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send temporary password"}
          </button>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {backLink}
        </form>
      )}
    </section>
  );
}

export default ForgotPassword;
