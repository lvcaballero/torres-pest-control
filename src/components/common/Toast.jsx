// A single toast. Rendered by ToastProvider, not used directly.
//
// An optional `action` ({ label, onClick }) adds one button — "Undo" after a
// drag on the calendar. Clicking it runs the action and dismisses the toast.

import { neutral, status } from "../../styles/tokens";

const TONES = {
  success: { background: status.successSurface, border: "rgba(74, 107, 74, 0.28)", color: status.success },
  error: { background: status.dangerSurface, border: "rgba(154, 45, 36, 0.28)", color: status.danger },
  info: { background: "#ffffff", border: neutral.loam, color: neutral.saddle },
};

function Toast({ message, tone = "success", action = null, onDismiss }) {
  const palette = TONES[tone] || TONES.info;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        borderRadius: "7.5px",
        padding: "0.75rem 0.9rem",
        fontWeight: 500,
        fontSize: "0.875rem",
        boxShadow: "none",
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.45 }}>{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          style={{
            border: `1px solid ${neutral.ink}`,
            background: "transparent",
            color: neutral.ink,
            borderRadius: "3.75px",
            padding: "4px 10px",
            fontWeight: 500,
            fontSize: "0.8rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          fontWeight: 500,
          cursor: "pointer",
          lineHeight: 1,
          fontSize: "1rem",
        }}
      >
        ×
      </button>
    </div>
  );
}

export default Toast;
