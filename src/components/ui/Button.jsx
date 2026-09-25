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
  quietButton,
  secondaryButton,
  successButton,
} from "../../styles/theme";

const VARIANTS = {
  primary: primaryButton,
  secondary: secondaryButton,
  /** Loam-edged white: everyday row actions that shouldn't compete. */
  quiet: quietButton,
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

// Three fixed heights so a button never sits taller or shorter than the
// dropdown beside it: 28 for dense rows, 34 for toolbars (matching a 36px
// input once its border is counted), 44 for a thumb-sized primary.
const SIZES = {
  sm: { minHeight: "28px", padding: "0 10px", fontSize: "12.5px" },
  md: { minHeight: "34px", padding: "0 14px", fontSize: "13.5px" },
  lg: { minHeight: "44px", padding: "0 18px", fontSize: "15px" },
  /** A square control sized for a bare icon — chevrons, close, kebab. */
  icon: { width: "34px", height: "34px", padding: 0, fontSize: text.body.fontSize, lineHeight: 0 },
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
