// The eyebrow + title block at the top of every page.
//
// The eyebrow is not decoration: this design language opens every section
// with a small uppercase label on wide tracking, which gives the page the
// cadence of a newspaper dateline. Headings use the display face at weight
// 500 — the restraint is the signature, and 700 reads as a different product.

import { eyebrow as eyebrowStyle, heading } from "../../styles/theme";
import { text } from "../../styles/tokens";

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div
      style={{
        marginBottom: "24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: "15px",
        flexWrap: "wrap",
      }}
    >
      <div>
        {eyebrow && <p style={eyebrowStyle}>{eyebrow}</p>}
        <h1 style={{ ...heading, marginTop: eyebrow ? "2px" : 0 }}>{title}</h1>
        {description && (
          <p style={{ ...text.body, margin: "6px 0 0", maxWidth: "62ch" }}>{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export default PageHeader;
