// A content surface: white, lifted off the parchment canvas by a hairline
// border and nothing else.
//
// Pages previously each hand-rolled this. They drifted — ClientsPage used an
// 18px radius with a slate border while theme.js's `card` used 20px with a
// red-tinted one — which is most of why the app read as several products
// stitched together.

import { surface, text } from "../../styles/tokens";
import { card, eyebrow as eyebrowStyle, subheading } from "../../styles/theme";

function Panel({
  title,
  eyebrow,
  actions = null,
  footer = null,
  padded = true,
  children,
  style,
  ...rest
}) {
  const hasHeader = Boolean(title || eyebrow || actions);

  return (
    <section style={{ ...card, padding: 0, ...style }} {...rest}>
      {hasHeader && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "15px",
            flexWrap: "wrap",
            padding: "15px 20px",
            borderBottom: `1px solid ${surface.sunken}`,
          }}
        >
          <div>
            {eyebrow && <p style={eyebrowStyle}>{eyebrow}</p>}
            {title && (
              <h2 style={{ ...subheading, fontSize: text.bodyLg.fontSize, marginTop: eyebrow ? "2px" : 0 }}>
                {title}
              </h2>
            )}
          </div>
          {actions}
        </header>
      )}

      <div style={padded ? { padding: "20px" } : undefined}>{children}</div>

      {footer && (
        <footer style={{ padding: "13px 20px", borderTop: `1px solid ${surface.sunken}` }}>
          {footer}
        </footer>
      )}
    </section>
  );
}

export default Panel;
