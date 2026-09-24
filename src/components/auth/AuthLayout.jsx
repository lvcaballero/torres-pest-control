// The frame both sign-in routes share: the form column on parchment and the
// dark olive panel with its line drawing. Keeping it in one place is what
// stops the reset page drifting from the sign-in page.

import { Link } from "react-router-dom";
import { Check, Lock } from "lucide-react";

/** Two houses, a magnifier over a pest, wheat on olive. From the handoff mockup. */
function HouseArt() {
  return (
    <svg
      className="auth-art"
      viewBox="0 0 460 250"
      fill="none"
      stroke="#f0c891"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M40 210h380" />
      <path d="M80 210V120l70-50 70 50v90" />
      <path d="M130 210v-50h40v50" />
      <path d="M100 130h20v20h-20zM180 130h20v20h-20z" />
      <path d="M60 138l90-66 90 66" />
      <path d="M290 210v-70h90v70" />
      <path d="M280 140h110l-20-26h-70z" />
      <path d="M310 165h22v22h-22z" />
      <path d="M350 165v45" />
      <circle cx="232" cy="178" r="16" />
      <path d="M244 190l14 14" />
      <path d="M226 178q6-6 12 0M229 172l-4-4M235 172l4-4" />
      <path d="M20 210c10-14 18-14 26 0M410 210c8-10 16-10 24 0" />
    </svg>
  );
}

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <main className="auth-form-side">
        <Link to="/login" className="auth-brand" aria-label="Torres Pest Control">
          <img src="/login-logo.png" alt="" />
          <span>
            <span className="auth-brand-name">Torres</span>
            <span className="auth-brand-sub">Pest Control</span>
          </span>
        </Link>

        <div className="auth-form">{children}</div>

        <p className="auth-footer">© {new Date().getFullYear()} Torres Pest Control · Quezon City</p>
      </main>

      <aside className="auth-panel" aria-label="About this system">
        <p className="auth-panel-eyebrow">Field operations</p>
        <h2>Every visit, report and litre accounted for.</h2>
        <HouseArt />
        <ul className="auth-trust">
          <li>
            <Lock size={14} strokeWidth={1.6} aria-hidden="true" />
            Accounts managed by your admin
          </li>
          <li>
            <Check size={14} strokeWidth={1.6} aria-hidden="true" />
            Deactivated accounts lose access immediately
          </li>
        </ul>
      </aside>
    </div>
  );
}

export default AuthLayout;
