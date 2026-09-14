// The sign-in form. LoginPage owns the route; this owns the fields.

import { useState } from "react";
import { Link } from "react-router-dom";
import Field from "../common/Field";
import { colors } from "../../styles/theme";

function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordToggleHover, setPasswordToggleHover] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await onLogin?.(identifier, password);
    setSubmitting(false);

    // Sprint AC: the message must not reveal which field was wrong, so both
    // the "no such account" and "wrong password" cases land here identically.
    if (result !== true) {
      setError(typeof result === "string" ? result : "Invalid email/username or password.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-card">
      <div className="login-heading" style={{ textAlign: "center" }}>
        <img
          src="/login-logo.png"
          alt="Torres Pest Control"
          style={{
            display: "block",
            height: "44px",
            width: "auto",
            margin: "0 auto 0.8rem",
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
          Welcome!
        </h1>
        <p style={{ margin: "0.45rem 0 0", fontSize: "0.9rem", color: colors.muted, fontWeight: 500 }}>
          Access your Torres Pest Control System dashboard
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        <Field label="Email or username" style={{ fontWeight: 700, color: "#1f2937" }}>
          <input
            aria-label="Email or username"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            style={loginInputStyle}
            placeholder="Email or username"
            autoFocus
          />
        </Field>

        <Field label="Password" style={{ fontWeight: 700, color: "#1f2937" }}>
          <div style={passwordFieldWrapStyle}>
            <input
              aria-label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ ...loginInputStyle, paddingRight: "2.8rem" }}
              placeholder="Enter your password"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((curr) => !curr)}
              onMouseEnter={() => setPasswordToggleHover(true)}
              onMouseLeave={() => setPasswordToggleHover(false)}
              style={{
                ...passwordToggleStyle,
                color: passwordToggleHover ? "#334155" : "#64748b",
                fontWeight: passwordToggleHover ? 800 : 700,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
      </div>

      <div style={metaRowStyle}>
        <label style={checkboxStyle}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            style={checkboxInputStyle}
          />
          <span>Remember me</span>
        </label>

        <Link to="/forgot-password" style={forgotLinkStyle}>
          Forgot password?
        </Link>
      </div>

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
        {submitting ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

const loginInputStyle = {
  width: "100%",
  border: "1px solid #d7dfe8",
  borderRadius: "12px",
  padding: "0.88rem 0.95rem",
  fontSize: "0.96rem",
  background: "#ffffff",
  color: colors.body,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  transition: "border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
  outline: "none",
};

const passwordFieldWrapStyle = {
  position: "relative",
  display: "block",
};

const passwordToggleStyle = {
  position: "absolute",
  right: "0.8rem",
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: "#64748b",
  fontSize: "0.76rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
  cursor: "pointer",
  padding: 0,
  transition: "color 0.18s ease, opacity 0.18s ease",
};

const metaRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  marginTop: "1rem",
  marginBottom: "0.5rem",
  fontSize: "0.85rem",
  color: "#475569",
  lineHeight: 1.2,
};

const checkboxStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  fontWeight: 600,
  color: "#334155",
  lineHeight: 1,
};

const checkboxInputStyle = {
  width: "0.95rem",
  height: "0.95rem",
  accentColor: "#b91c1c",
  verticalAlign: "middle",
};

const forgotLinkStyle = {
  color: "#991b1b",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: "0.84rem",
  lineHeight: 1,
};

const loginButtonStyle = {
  marginTop: "1.1rem",
  width: "100%",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(180deg, #9f1d1d 0%, #7f1111 100%)",
  color: "#fff",
  padding: "0.9rem 1rem",
  fontWeight: 700,
  boxShadow: "0 14px 24px rgba(127, 17, 17, 0.2)",
};

export default Login;
