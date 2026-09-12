// "Forgot password?" form. Collects an email, asks the backend to email a
// temp password, and always shows the same success message — see
// authService.requestPasswordReset for why.

import { useState } from "react";
import { Link } from "react-router-dom";
import Field from "../common/Field";
import { colors } from "../../styles/theme";
import { requestPasswordReset } from "../../services/authService";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);

    if (result.error) setError(result.error);
    else setMessage(result.message);
  };

  return (
    <form onSubmit={handleSubmit} className="login-card" style={{ maxWidth: "440px", width: "100%", padding: "2rem" }}>
      <div className="login-heading" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <img
          className="login-logo"
          src="/login-logo.png"
          alt="Torres Pest Control"
          style={{
            display: "block",
            width: "auto",
            height: "54px",
            margin: "0 auto 0.9rem",
            objectFit: "contain",
          }}
        />
        <h1
          style={{
            margin: 0,
            color: colors.ink,
            fontSize: "2rem",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            textShadow: "none",
            WebkitTextStroke: "0 transparent",
            textRendering: "geometricPrecision",
          }}
        >
          Forgot Password
        </h1>
      </div>

      {message ? (
        <p style={{ margin: "1rem 0", color: colors.body, lineHeight: 1.6 }}>{message}</p>
      ) : (
        <>
          <p style={{ margin: "0 0 1rem", color: colors.muted, lineHeight: 1.6, fontSize: "0.9rem", textAlign: "center" }}>
            Enter your account email and we'll send a temporary password you can log in with.
          </p>
          <Field label="Email address" style={{ fontWeight: 700, color: "#1f2937" }}>
            <input
              aria-label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              style={loginInputStyle}
              autoFocus
              required
            />
          </Field>

          {error && (
            <div role="alert" style={{ marginTop: "1rem", color: colors.danger, fontWeight: 700, fontSize: "0.9rem" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit-button"
            disabled={submitting}
            style={{
              ...loginButtonStyle,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Sending…" : "Send Temporary Password"}
          </button>
        </>
      )}

      <p style={{ marginTop: "1.25rem", textAlign: "center" }}>
        <Link
          to="/login"
          style={{
            color: colors.brandInk,
            fontWeight: 700,
            fontSize: "0.88rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            transition: "opacity 0.18s ease, textDecoration 0.18s ease",
          }}
        >
          <span aria-hidden="true">←</span>
          <span>Back to Sign In</span>
        </Link>
      </p>
    </form>
  );
}

const loginInputStyle = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "0.82rem 0.9rem",
  fontSize: "0.96rem",
  background: "#ffffff",
  color: colors.body,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
};

const loginButtonStyle = {
  marginTop: "1rem",
  width: "100%",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(180deg, #9f1d1d 0%, #7f1111 100%)",
  color: "#fff",
  padding: "0.85rem 1rem",
  fontWeight: 800,
  boxShadow: "none",
  transition: "filter 0.18s ease, transform 0.18s ease",
};

export default ForgotPassword;
