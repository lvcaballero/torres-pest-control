// "Forgot password?" form. Collects an email, asks the backend to email a
// temp password, and always shows the same success message — see
// authService.requestPasswordReset for why.
//
// Shares Login's markup and class names so the two routes are the same design:
// cream panel with the curved right edge, red hero behind it. Anything styled
// here would drift from the sign-in page the next time that one is touched.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../services/authService";
import { resetLine } from "../../utils/greetings";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Picked once per mount, same as the sign-in hero: this text is rendered
  // twice, on the red panel and in the cream layer showing through the curve.
  const hero = useMemo(() => resetLine(), []);

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
    <main className="standalone-login-card">
      <section className="standalone-form-panel" aria-labelledby="title">
        <span className="accent-bar" aria-hidden="true" />

        <div className="standalone-form-inner">
          <div className="tp-logo" aria-label="Torres Pest Control logo" role="img">
            <img src="/login-logo.png" alt="Torres Pest Control logo" className="tp-logo-image" />
          </div>

          <h1 id="title">Forgot password</h1>
          <p className="sub">
            {message
              ? "Check your inbox."
              : "Enter your account email and we'll send a temporary password you can sign in with."}
          </p>

          {message ? (
            <div className="standalone-login-form">
              <p className="status" role="status">{message}</p>
              <p className="row row-back">
                <Link className="link" to="/login">← Back to sign in</Link>
              </p>
            </div>
          ) : (
            <form className="standalone-login-form" noValidate onSubmit={handleSubmit}>
              <div className="field">
                <label className="lbl" htmlFor="reset-email">Email address</label>
                <input
                  id="reset-email"
                  name="email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  aria-invalid={Boolean(error)}
                  autoFocus
                />
              </div>

              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send temporary password"}
              </button>

              {error && <p className="err" role="alert">{error}</p>}

              <div className="row row-back">
                <Link className="link" to="/login">← Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </section>

      <aside className="hero-layer on-red" aria-label="Torres Pest Control password help message">
        <div className="hero">
          <div className="bar" aria-hidden="true" />
          <h2>{hero}</h2>
        </div>
      </aside>

      <div className="hero-layer on-cream" aria-hidden="true">
        <div className="hero">
          <div className="bar" aria-hidden="true" />
          <h2>{hero}</h2>
        </div>
      </div>
    </main>
  );
}

export default ForgotPassword;
