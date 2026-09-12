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
    <form onSubmit={handleSubmit} className="login-card">
      <div className="login-heading">
        <img className="login-logo" src="/login-logo.png" alt="Torres Pest Control" />
        <h1 style={{ margin: "0.45rem 0 0", fontSize: "1.05rem", color: colors.ink, fontWeight: 800 }}>
          Forgot Password
        </h1>
      </div>

      {message ? (
        <p style={{ margin: "1rem 0", color: colors.body, lineHeight: 1.6 }}>{message}</p>
      ) : (
        <>
          <p style={{ margin: "0 0 1rem", color: colors.muted, lineHeight: 1.6, fontSize: "0.9rem" }}>
            Enter your account email and we'll send a temporary password you can log in with.
          </p>
          <Field label="Email">
            <input
              aria-label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            style={{ ...loginButtonStyle, opacity: submitting ? 0.7 : 1, cursor: submitting ? "default" : "pointer" }}
          >
            {submitting ? "Sending…" : "Send Temporary Password"}
          </button>
        </>
      )}

      <p style={{ marginTop: "1.25rem", textAlign: "center" }}>
        <Link to="/login" style={{ color: colors.brandInk, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}>
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}

const loginInputStyle = {
  width: "100%",
  border: "1px solid #d9e3f3",
  borderRadius: "12px",
  padding: "0.82rem 0.9rem",
  fontSize: "0.96rem",
  background: "#eaf1fd",
  color: colors.body,
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
};

const loginButtonStyle = {
  marginTop: "1rem",
  width: "100%",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(100deg, #9d1212 0%, #c83e3e 100%)",
  color: "#fff",
  padding: "0.78rem 1rem",
  fontWeight: 800,
  boxShadow: "0 12px 24px rgba(127, 17, 17, 0.24)",
};

export default ForgotPassword;
