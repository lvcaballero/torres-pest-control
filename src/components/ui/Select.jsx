// A select carrying the shared control styling.

import { forwardRef } from "react";
import { inputStyle, invalidInputStyle } from "../../styles/theme";

const Select = forwardRef(function Select({ invalid = false, style, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      style={{ ...(invalid ? invalidInputStyle : inputStyle), ...style }}
      {...rest}
    >
      {children}
    </select>
  );
});

export default Select;
