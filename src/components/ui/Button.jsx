// The app's only button.
//
// There was no shared button before this: every call site spread one of the
// four `*Button` objects from theme.js and then patched the padding inline,
// which is why the same control had five paddings and three radii depending
// on the page. Variants live here now.
//
// The `.ui-interactive` class is what opts a control into the hover
// treatment in globals.css. That rule used to apply to every button and link
// in the app, including calendar cards.

import { forwardRef } from "react";
import { radius, text, weight } from "../../styles/tokens";
import {
  destructiveButton,
  primaryButton,
  secondaryButton,
  successButton,
} from "../../styles/theme";

const VARIANTS = {
  primary: primaryButton,
  secondary: secondaryButton,
  danger: destructiveButton,
  success: successButton,
  ghost: {
    border: "1px solid transparent",
    background: "transparent",
    color: "inherit",
    borderRadius: radius.control,
    fontWeight: weight.medium,
    cursor: "pointer",
  },
};

const SIZES = {
  sm: { padding: "5px 10px", fontSize: text.caption.fontSize },
  md: { padding: "9px 15px", fontSize: text.body.fontSize },
  lg: { padding: "11px 22px", fontSize: text.bodyLg.fontSize },
  /** A square control sized for a bare icon — chevrons, close, kebab. */
  icon: { padding: "7px", fontSize: text.body.fontSize, lineHeight: 0 },
};

const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    disabled = false,
    icon = null,
    type = "button",
    style,
    className = "",
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`ui-interactive ${className}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        whiteSpace: "nowrap",
        ...(VARIANTS[variant] || VARIANTS.secondary),
        ...(SIZES[size] || SIZES.md),
        // A disabled control must not also look clickable.
        ...(isDisabled ? { cursor: "default", opacity: 0.5 } : null),
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export default Button;
