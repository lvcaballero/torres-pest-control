// A text input carrying the shared control styling.
//
// Exists so `invalid` is a prop rather than a per-call-site conditional
// spread of invalidInputStyle, which several pages got subtly wrong.

import { forwardRef } from "react";
import { inputStyle, invalidInputStyle } from "../../styles/theme";

const Input = forwardRef(function Input({ invalid = false, style, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      style={{ ...(invalid ? invalidInputStyle : inputStyle), ...style }}
      {...rest}
    />
  );
});

export default Input;
