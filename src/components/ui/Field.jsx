// Labelled form field with optional hint and inline validation message.
//
// Supersedes components/common/Field.jsx and the local copies that
// InventoryPage, SchedulingPage and UserAccountsPage each redefined with
// their own paddings and label weights. `required` renders the marker the
// old copies left every form to draw by hand.
//
// It renders a <label> wrapping its control, so clicking the text focuses
// the input without needing a matching id.

import { neutral, status, text, weight } from "../../styles/tokens";

function Field({ label, error, hint, required = false, children, style, ...rest }) {
  return (
    <label style={{ display: "grid", gap: "6px", ...style }} {...rest}>
      <span
        style={{
          color: neutral.ink,
          fontWeight: weight.medium,
          fontSize: text.small.fontSize,
        }}
      >
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: status.danger, marginLeft: "3px" }}>
            *
          </span>
        )}
      </span>

      {children}

      {hint && !error && (
        <span style={{ color: neutral.bark, fontSize: text.caption.fontSize }}>{hint}</span>
      )}

      {error && (
        <span
          role="alert"
          style={{
            color: status.danger,
            fontWeight: weight.medium,
            fontSize: text.caption.fontSize,
          }}
        >
          {error}
        </span>
      )}
    </label>
  );
}

export default Field;
