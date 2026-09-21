// A row of mutually exclusive options.
//
// Replaces three inline copies in SchedulingPage: the Calendar/List/
// Technicians tabs, the Week/Month toggle, and the detail panel's tabs.
//
// Rendered as a real radiogroup so arrow keys work and screen readers
// announce it as a choice rather than as a row of unrelated buttons.

import { neutral, radius, surface, text, weight } from "../../styles/tokens";

/**
 * @param options  [{ value, label, icon? }] or plain strings
 * @param value    the selected value
 * @param onChange called with the newly selected value
 */
function SegmentedControl({ options, value, onChange, size = "md", disabled = false, style, ariaLabel }) {
  const items = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  const padding = size === "sm" ? "4px 9px" : "6px 13px";
  const fontSize = size === "sm" ? text.caption.fontSize : text.small.fontSize;

  const move = (delta) => {
    const index = items.findIndex((item) => item.value === value);
    const next = items[(index + delta + items.length) % items.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        gap: "2px",
        padding: "2px",
        background: surface.sunken,
        borderRadius: radius.control,
        ...style,
      }}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            // Only the selected option is a tab stop; arrows move between them.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(-1);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid transparent",
              borderRadius: "2px",
              padding,
              fontSize,
              fontWeight: selected ? weight.medium : weight.regular,
              background: selected ? surface.panel : "transparent",
              color: selected ? neutral.ink : neutral.saddle,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
