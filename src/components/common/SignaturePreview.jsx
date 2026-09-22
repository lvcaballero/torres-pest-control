// A stored signature, rendered small and enlargeable.
//
// Signatures are uploaded images like any other, but they were the one kind
// with no way to see them full size: they rendered at 100px tall and were not
// clickable at all. Clicking one now opens the same lightbox an attachment
// does, rather than sending the signed URL to a new tab.
//
// The signed URL is already in hand here — the parent minted it to show the
// thumbnail — so there is nothing to fetch on click.

import { useState } from "react";
import ImagePreviewModal from "./ImagePreviewModal";
import { colors } from "../../styles/theme";

function SignaturePreview({ url, alt, name, imageStyle, loadingLabel = "Loading signature…" }) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return <span style={{ color: colors.muted, fontSize: "0.76rem" }}>{loadingLabel}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Click to enlarge"
        aria-label={`Enlarge ${alt.toLowerCase()}`}
        style={{
          display: "block",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "zoom-in",
          maxWidth: "100%",
        }}
      >
        <img src={url} alt={alt} style={{ display: "block", maxWidth: "100%", maxHeight: "100px", ...imageStyle }} />
      </button>

      <ImagePreviewModal
        file={open ? { name: name || alt } : null}
        url={url}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export default SignaturePreview;
