// The standard content surface: white, a #e6dfd3 hairline, 7.5px corners,
// no shadow. An optional header row carries a serif title (17px — the serif
// turns muddy any smaller), a muted aside and right-aligned actions.

import { neutral, text } from "../../styles/tokens";
import { card, colors, eyebrow as eyebrowStyle, serifTitle } from "../../styles/theme";

function Card({
  title,
  eyebrow,
  aside = null,
  actions = null,
  footer = null,
  padded = true,
  as: Tag = "section",
  children,
  style,
  bodyStyle,
  ...rest
}) {
  const hasHeader = Boolean(title || eyebrow || actions || aside);

  return (
    <Tag style={{ ...card, padding: 0, minWidth: 0, ...style }} {...rest}>
      {hasHeader && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            padding: "14px 18px",
            borderBottom: `1px solid ${colors.line}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", minWidth: 0 }}>
            {eyebrow && <p style={{ ...eyebrowStyle, fontSize: "11.5px" }}>{eyebrow}</p>}
            {title && <h2 style={serifTitle}>{title}</h2>}
            {aside && <span style={{ color: neutral.bark, fontSize: text.small.fontSize }}>{aside}</span>}
          </div>
          {actions && <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>{actions}</div>}
        </header>
      )}

      <div style={{ ...(padded ? { padding: "18px" } : null), ...bodyStyle }}>{children}</div>

      {footer && <footer style={{ padding: "12px 18px", borderTop: `1px solid ${colors.line}` }}>{footer}</footer>}
    </Tag>
  );
}

export default Card;
