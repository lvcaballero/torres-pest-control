// A single toast. Rendered by ToastProvider, not used directly.

const TONES = {
  success: { background: "#eef2ec", border: "#bbf7d0", color: "#4a6b4a" },
  error: { background: "#f9ecea", border: "#fecaca", color: "#9a2d24" },
  info: { background: "#efe9e0", border: "#efe9e0", color: "#50463c" },
};

function Toast({ message, tone = "success", onDismiss }) {
  const palette = TONES[tone] || TONES.info;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        borderRadius: "7.5px",
        padding: "0.85rem 1rem",
        fontWeight: 500,
        fontSize: "0.9rem",
        boxShadow: "none",
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.45 }}>{message}</span>
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
