// A textarea carrying the shared control styling.

import { forwardRef } from "react";
import { inputStyle, invalidInputStyle } from "../../styles/theme";

const Textarea = forwardRef(function Textarea({ invalid = false, style, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      style={{ ...(invalid ? invalidInputStyle : inputStyle), resize: "vertical", ...style }}
      {...rest}
    />
  );
});

export default Textarea;
