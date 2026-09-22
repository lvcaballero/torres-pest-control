// The one lightbox every uploaded image opens in.
//
// Images used to leave the app: Preview minted a signed URL and handed it to
// window.open(), so a photo opened in a brand new tab, on Supabase's domain,
// behind a URL that expires in 60 seconds — reload it a minute later and it is
// a 400. Three separate copies of a lightbox already existed (the tile layout
// in ClientDocuments, HistoryFileList in ClientDetails, and nothing at all in
// the compact layout, which is the one the Client Profile and Scheduling
// document tabs actually use). This is that lightbox, once, for all of them.
//
// Non-images — PDFs, DOCX — still open in a tab. The browser renders those
// itself and an <img> cannot.

import { useEffect } from "react";
import { Download, X } from "lucide-react";

/** Does this file render in an <img>? Storage may not have given us a MIME type. */
export function isImageFile(file) {
  if (!file) return false;
  return Boolean(
    file.type?.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name || "")
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  backgroundColor: "rgba(15, 23, 42, 0.8)",
  backdropFilter: "blur(4px)",
};

const panelStyle = {
  position: "relative",
  maxWidth: "52rem",
  maxHeight: "90vh",
  backgroundColor: "#ffffff",
  borderRadius: "1rem",
  overflow: "hidden",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  display: "flex",
  flexDirection: "column",
  width: "100%",
};

const iconButtonStyle = {
  padding: "0.375rem",
  color: "#96897b",
  backgroundColor: "transparent",
  border: "none",
  borderRadius: "0.375rem",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/**
 * @param {object|null} file    the file being shown; null closes the modal
 * @param {string|null} url     its signed URL, or null while one is being minted
 * @param {function}    onClose
 * @param {function}    [onDownload] omit to hide the download button
 */
function ImagePreviewModal({ file, url, onClose, onDownload }) {
  // Esc closes it. Registered only while open, so it cannot swallow the key
  // from a dialog underneath.
  useEffect(() => {
    if (!file) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, onClose]);

  if (!file) return null;

  const title = file.name || "Attachment";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${title}`}
      onClick={onClose}
      style={overlayStyle}
    >
      <div onClick={(event) => event.stopPropagation()} style={panelStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderBottom: "1px solid #efe9e0",
            backgroundColor: "#efe9e0",
          }}
        >
          <span
            title={title}
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#1e293b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {onDownload && (
              <button type="button" onClick={() => onDownload(file)} title="Download" aria-label="Download" style={iconButtonStyle}>
                <Download style={{ width: "1rem", height: "1rem" }} />
              </button>
            )}
            <button type="button" onClick={onClose} title="Close" aria-label="Close preview" style={iconButtonStyle}>
              <X style={{ width: "1rem", height: "1rem" }} />
            </button>
          </div>
        </div>
        <div
          style={{
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            minHeight: "240px",
            backgroundColor: "#090d16",
          }}
        >
          {url ? (
            <img
              src={url}
              alt={title}
              style={{ maxHeight: "75vh", maxWidth: "100%", objectFit: "contain", borderRadius: "0.375rem" }}
            />
          ) : (
            <div style={{ fontSize: "0.75rem", color: "#96897b" }}>Loading preview…</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImagePreviewModal;
