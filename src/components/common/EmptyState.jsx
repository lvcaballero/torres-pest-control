// Consistent "nothing here" panel.

import { neutral, radius, surface, text } from "../../styles/tokens";

function EmptyState({ message, children }) {
  return (
    <div
      style={{
        padding: "30px 20px",
        background: surface.sunken,
        border: `1px solid ${neutral.loam}`,
        borderRadius: radius.card,
        color: neutral.bark,
        textAlign: "center",
        ...text.body,
      }}
    >
      <div>{message}</div>
      {children && <div style={{ marginTop: "12px" }}>{children}</div>}
    </div>
  );
}

export default EmptyState;
