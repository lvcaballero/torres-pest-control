// Full client profile: read-only summary, edit form, and documents.
//
// Sprint AC (View Single Client Profile): "Detail view displays full client
// information, classification, and attached documents" and "Staff can
// navigate back to the list or edit the profile from this view." Back
// navigation was missing entirely — the old page imported only useParams,
// with no Link anywhere.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Eye, FileText, PencilLine, Printer, Trash2, X } from "lucide-react";
import ClientForm from "./ClientForm";
import ClientDocuments, { CATEGORY_TAGS } from "./ClientDocuments";
import ImagePreviewModal, { isImageFile } from "../common/ImagePreviewModal";
import SignaturePreview from "../common/SignaturePreview";
import ServiceReportPrinter from "../scheduling/ServiceReportPrinter";
import PageHeader from "../common/PageHeader";
import { useScheduling } from "../../context/SchedulingContext";
import useUsers from "../../hooks/useUsers";
import useInventory from "../../hooks/useInventory";
import { formatDate, formatDateTime, formatFileSize, formatTime, humanizeEnum } from "../../utils/formatters";
import { DOCUMENT_CATEGORIES } from "../../utils/constants";
import { crewOf } from "../../utils/scheduling";
import { colors, dangerButton, pageShell, primaryButton, secondaryButton } from "../../styles/theme";


const peso = (value) => `₱${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function treatmentMethodLabel(value) {
  if (!value) return "";
  const str = typeof value === "object" ? (value.label || value.name || value.value || "") : String(value);
  if (!str) return "";
  return str.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}


function HistoryFileList({ files = [], onOpen, onResolveUrl, onRemove, emptyMessage }) {
  const [modalFile, setModalFile] = useState(null);
  const [modalUrl, setModalUrl] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});

  useEffect(() => {
    let active = true;
    if (!onResolveUrl) return;

    files.forEach((file) => {
      const isImage = isImageFile(file);
      if (isImage && !file.url && !file.previewUrl && !thumbUrls[file.id]) {
        onResolveUrl(file, { download: false })
          .then((res) => {
            if (active && res?.url) {
              setThumbUrls((prev) => ({ ...prev, [file.id]: res.url }));
            }
          })
          .catch(() => {});
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, onResolveUrl]);

  if (files.length === 0) {
    return <div style={{ marginTop: "0.35rem", color: colors.muted, fontSize: "0.84rem", fontStyle: "italic" }}>{emptyMessage}</div>;
  }

  const handlePreview = async (file) => {
    if (isImageFile(file)) {
      setModalFile(file);
      const cached = thumbUrls[file.id] || file.url || file.previewUrl;
      if (cached) {
        setModalUrl(cached);
      } else if (onResolveUrl) {
        setModalUrl(null);
        const res = await onResolveUrl(file, { download: false });
        if (res?.url) {
          setModalUrl(res.url);
          setThumbUrls((prev) => ({ ...prev, [file.id]: res.url }));
        }
      }
    } else {
      await onOpen?.(file, false);
    }
  };

  const handleDownload = (file) => {
    onOpen?.(file, true);
  };

  const handleRemove = async (file) => {
    if (!onRemove) return;
    setBusyId(file.id);
    await onRemove(file);
    setBusyId(null);
  };

  return (
    <>
      <div className="mt-2.5">
        {files.map((file) => {
          const busy = busyId === file.id;
          const isImage = isImageFile(file);
          const imgSrc = thumbUrls[file.id] || file.url || file.previewUrl;
          const fileTag = file.tag || (file.category && (CATEGORY_TAGS[file.category]?.label || file.category));

          return (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors mb-2"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.5rem",
                backgroundColor: "#ffffff",
                borderRadius: "0.75rem",
                border: "1px solid rgba(226, 232, 240, 0.8)",
                marginBottom: "0.5rem",
                minWidth: 0,
                transition: "border-color 0.15s ease",
              }}
            >
              <div
                className="flex items-center gap-2.5 min-w-0 flex-1"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  minWidth: 0,
                  flex: "1 1 0%",
                }}
              >
                {/* Square Thumbnail Preview or Fallback */}
                {isImage ? (
                  <div
                    className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer relative group"
                    onClick={() => handlePreview(file)}
                    title="Click to preview"
                    style={{
                      width: "2.25rem",
                      height: "2.25rem",
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                      border: "1px solid #efe9e0",
                      backgroundColor: "#efe9e0",
                      flexShrink: 0,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <img
                      src={imgSrc}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 text-slate-500"
                    style={{
                      width: "2.25rem",
                      height: "2.25rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #efe9e0",
                      backgroundColor: "#efe9e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#96897b",
                    }}
                  >
                    <FileText className="w-4 h-4" style={{ width: "1rem", height: "1rem" }} />
                  </div>
                )}

                {/* Tag, Filename, and Date */}
                <div
                  className="flex flex-col min-w-0"
                  style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
                >
                  <div
                    className="flex items-center gap-1.5 min-w-0"
                    style={{ display: "flex", alignItems: "center", gap: "0.375rem", minWidth: 0 }}
                  >
                    {fileTag && (
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0"
                        style={{
                          padding: "0.125rem 0.375rem",
                          fontSize: "0.625rem",
                          fontWeight: 500,
                          borderRadius: "0.25rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          backgroundColor: "#eef2ec",
                          color: "#4a6b4a",
                          border: "1px solid #a7f3d0",
                          flexShrink: 0,
                        }}
                      >
                        {fileTag}
                      </span>
                    )}
                    <span
                      className="text-xs font-semibold text-slate-800 truncate"
                      title={file.name}
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "#1e293b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </span>
                  </div>
                  <span
                    className="text-[10px] text-slate-400 mt-0.5 truncate"
                    style={{ fontSize: "0.625rem", color: "#96897b", marginTop: "0.125rem" }}
                  >
                    {file.size ? `${typeof file.size === "number" ? formatFileSize(file.size) : file.size} • ` : ""}
                    {file.date || (file.uploadedAt ? formatDateTime(file.uploadedAt) : "Attached")}
                  </span>
                </div>
              </div>

              {/* Right Side (Action Icon Buttons) */}
              <div
                className="flex items-center gap-1 shrink-0"
                style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}
              >
                <button
                  type="button"
                  title="Preview"
                  onClick={() => handlePreview(file)}
                  disabled={busy}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  style={{
                    padding: "0.375rem",
                    color: "#96897b",
                    backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: busy ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Eye className="w-3.5 h-3.5" style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
                <button
                  type="button"
                  title="Download"
                  onClick={() => handleDownload(file)}
                  disabled={busy}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  style={{
                    padding: "0.375rem",
                    color: "#96897b",
                    backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: busy ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Download className="w-3.5 h-3.5" style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
                {onRemove && (
                  <button
                    type="button"
                    title="Remove attachment"
                    onClick={() => handleRemove(file)}
                    disabled={busy}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    style={{
                      padding: "0.375rem",
                      color: "#96897b",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: busy ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ width: "0.875rem", height: "0.875rem" }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ImagePreviewModal
        file={modalFile}
        url={modalUrl}
        onClose={() => {
          setModalFile(null);
          setModalUrl(null);
        }}
        onDownload={(file) => onOpen?.(file, true)}
      />
    </>
  );
}

const neutralCard = {
  background: "#ffffff",
  border: "1px solid #efe9e0",
  borderRadius: "7.5px",
  boxShadow: "none",
};

function ClientDetails({
  client,
  canEdit,
  canDelete,
  canUploadDocuments,
  canRemoveDocuments,
  onSave,
  onDelete,
  onUploadDocument,
  onRemoveDocument,
  onResolveDocumentUrl,
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const { appointments, getAttachmentUrl, getSignatureUrl, removeAttachment } = useScheduling();
  const { staff, technicians } = useUsers();
  const { inventory } = useInventory();
  const accounts = [...staff, ...technicians];
  const serviceHistory = appointments
    .filter((appointment) => appointment.clientId === client.id && appointment.status === "Completed")
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
  const [printRequest, setPrintRequest] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [technicianSignatureUrl, setTechnicianSignatureUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!selectedHistory?.signaturePath) setSignatureUrl("");
    else getSignatureUrl(selectedHistory.signaturePath).then((result) => {
      if (!cancelled) setSignatureUrl(result?.url || "");
    });
    if (!selectedHistory?.technicianSignaturePath) setTechnicianSignatureUrl("");
    else getSignatureUrl(selectedHistory.technicianSignaturePath).then((result) => {
      if (!cancelled) setTechnicianSignatureUrl(result?.url || "");
    });
    return () => { cancelled = true; };
  }, [selectedHistory?.signaturePath, selectedHistory?.technicianSignaturePath, getSignatureUrl]);

  // Reached for downloads and for non-images (PDF, DOCX) only: HistoryFileList
  // sends images to its lightbox instead of to a new tab.
  const openHistoryDocument = async (document, download = false) => {
    const result = await onResolveDocumentUrl(document, { download });
    if (result?.url) window.open(result.url, download ? "_self" : "_blank", "noopener,noreferrer");
  };
  const openHistoryAttachment = async (attachment, download = false) => {
    const result = await getAttachmentUrl(attachment, { download });
    if (result?.url) window.open(result.url, download ? "_self" : "_blank", "noopener,noreferrer");
  };

  const handleRemoveVisitAttachment = async (file) => {
    if (typeof window !== "undefined" && window.confirm) {
      const confirmed = window.confirm(`Are you sure you want to remove ${file.name || "this attachment"}?`);
      if (!confirmed) return;
    }
    const result = await removeAttachment({ ...file, appointmentId: file.appointmentId || selectedHistory?.id });
    if (result === true) {
      setSelectedHistory((prev) => prev ? {
        ...prev,
        attachments: (prev.attachments || []).filter((a) => a.id !== file.id),
      } : prev);
    }
  };
  const overviewFields = useMemo(
    () => [
      { label: "Client No.", value: client.reference || "—" },
      { label: "Classification", value: client.classification === "OTHER" && client.classificationOther ? client.classificationOther : humanizeEnum(client.classification) },
      { label: "Source", value: client.source || "—" },
      { label: "Phone", value: client.phone || "—" },
      { label: "Email", value: client.email || "—" },
      { label: "Address", value: client.address || "—", fullWidth: true },
    ],
    [client]
  );

  return (
    <div style={pageShell}>
      <PageHeader
        eyebrow={client.reference ? `Client Profile · ${client.reference}` : "Client Profile"}
        title={client.name}
        actions={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.9rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.65rem", flexWrap: "wrap" }}>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  ...primaryButton,
                  padding: "0.65rem 0.9rem",
                  fontSize: "0.82rem",
                }}
              >
                <PencilLine size={15} /> Edit Profile
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  ...dangerButton,
                  padding: "0.65rem 0.9rem",
                  fontSize: "0.82rem",
                  background: "#fff1f2",
                  color: "#be123c",
                  border: "1px solid #fecdd3",
                  boxShadow: "none",
                }}
              >
                <Trash2 size={15} /> Delete Permanently
              </button>
            )}
            </div>
            <Link
              to="/clients"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                ...secondaryButton,
                textDecoration: "none",
                padding: "0.65rem 0.9rem",
                fontSize: "0.82rem",
              }}
            >
              <ArrowLeft size={16} /> Back to Client Profiles
            </Link>
          </div>
        }
      />

      <section style={{ ...neutralCard, marginBottom: "1rem", padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "#96897b", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>Client record</p>
            <h2 style={{ margin: "0.35rem 0 0", color: colors.ink, fontSize: "1.2rem", fontWeight: 500 }}>Profile overview</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          {overviewFields.map((field) => (
            <div key={field.label} style={{ gridColumn: field.fullWidth ? "1 / -1" : "span 1" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#96897b" }}>
                {field.label}
              </div>
              <div style={{ marginTop: "0.35rem", fontSize: "0.95rem", color: "#211b15", fontWeight: 500, lineHeight: 1.5 }}>
                {field.value}
              </div>
            </div>
          ))}
        </div>

        {client.serviceNotes && (
          <div style={{ marginTop: "1.25rem", padding: "0.85rem 1rem", background: "#fcfaf1", border: "1px solid #efe9e0", borderRadius: "3.75px" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#96897b" }}>
              Service notes
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "0.88rem", color: "#211b15", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {client.serviceNotes}
            </div>
          </div>
        )}

        <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #efe9e0", fontSize: "0.74rem", color: "#96897b" }}>
          Created {formatDateTime(client.createdAt)} • Last updated {formatDateTime(client.updatedAt)}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        <section style={{ ...neutralCard, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, color: "#96897b", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>Client history</p>
              <h2 style={{ margin: "0.35rem 0 0", color: colors.ink, fontSize: "1.2rem" }}>Service history</h2>
            </div>
            <span style={{ color: colors.muted, fontSize: "0.8rem" }}>{serviceHistory.length} appointment{serviceHistory.length === 1 ? "" : "s"}</span>
          </div>
          {serviceHistory.length === 0 ? (
            <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: "3.75px", background: "#efe9e0", color: colors.muted, fontSize: "0.85rem" }}>No service history recorded yet.</div>
          ) : (
            /* A table, not a stack of cards.
               The cards reprinted the whole report — findings, treatment,
               attachments, materials — for every visit, so reading a client's
               history meant scrolling past four paragraphs to reach the next
               date. The four fields the office actually scans across are the
               date, the terms it was done on, what it cost, and when the visit
               before it was. Everything else is one click away: the row still
               opens the full report. */
            <div style={{ marginTop: "1rem", overflowX: "auto", border: "1px solid #efe9e0", borderRadius: "3.75px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
                <thead>
                  <tr style={{ background: "#fcfaf1" }}>
                    {["Date", "Frequency", "Price", "Last appointment"].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        style={{ padding: "0.7rem 0.75rem", color: colors.muted, fontSize: "0.68rem", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #efe9e0", fontWeight: 500 }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serviceHistory.map((appointment, index) => {
                    // serviceHistory is newest first, so the visit before this
                    // one is the next row down.
                    const previous = serviceHistory[index + 1];
                    return (
                      <tr
                        key={appointment.id}
                        onClick={() => setSelectedHistory(appointment)}
                        style={{ cursor: "pointer" }}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedHistory(appointment);
                          }
                        }}
                      >
                        <td style={{ padding: "0.75rem", color: colors.ink, fontWeight: 500, borderBottom: "1px solid #f1e7e7" }}>
                          {formatDateTime(appointment.scheduledAt)}
                        </td>
                        <td style={{ padding: "0.75rem", color: colors.body, borderBottom: "1px solid #f1e7e7" }}>
                          {appointment.serviceFrequency || "—"}
                        </td>
                        <td style={{ padding: "0.75rem", color: colors.body, borderBottom: "1px solid #f1e7e7" }}>
                          {appointment.price === "" || appointment.price === null || appointment.price === undefined
                            ? "—"
                            : peso(appointment.price)}
                        </td>
                        <td style={{ padding: "0.75rem", color: colors.muted, borderBottom: "1px solid #f1e7e7" }}>
                          {previous ? formatDate(previous.scheduledAt) : "First visit"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div style={{ ...neutralCard, padding: "1rem 1.25rem" }}>
          <h2 style={{ marginTop: 0, marginBottom: "0.3rem", color: colors.body, fontSize: "1.05rem" }}>Client documents</h2>
          <p style={{ margin: "0 0 1rem", color: colors.muted, fontSize: "0.76rem" }}>Paperwork that belongs to the client, not to one visit. Photos and signed forms for a service go in that appointment's Report tab.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "0.7rem", alignItems: "start" }}>
            {DOCUMENT_CATEGORIES.map((category) => <ClientDocuments
              key={category.value}
              compact
              title={category.label}
              uploadLabel={category.uploadLabel}
              documents={(client.documents || []).filter((document) => (document.category || "OTHER") === category.value)}
              canUpload={canUploadDocuments}
              canRemove={canRemoveDocuments}
              onUpload={(file) => onUploadDocument(file, category.value)}
              onRemove={onRemoveDocument}
              onResolveUrl={onResolveDocumentUrl}
              emptyMessage="None uploaded yet."
            />)}
          </div>
        </div>
      </div>

      <ServiceReportPrinter request={printRequest} onDone={() => setPrintRequest(null)} onProblem={(text) => window.alert(text)} getAttachmentUrl={getAttachmentUrl} getSignatureUrl={getSignatureUrl} />

      {selectedHistory && (() => {
        const technician = accounts.find((a) => a.id === selectedHistory.technicianId);
        const crew = crewOf(selectedHistory)
          .map((id) => accounts.find((account) => account.id === id))
          .map((account) => account?.name || account?.username)
          .filter(Boolean);
        const technicianName = crew.join(", ") || technician?.name || technician?.username || "Unassigned";
        const treatmentMethods = (selectedHistory.treatmentMethods || []).map(treatmentMethodLabel);

        return (
          <div
            role="dialog"
            aria-modal="true"
            style={{ position: "fixed", inset: 0, zIndex: 30, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.45)" }}
            onClick={() => setSelectedHistory(null)}
          >
            <section
              style={{ ...neutralCard, width: "min(100%, 660px)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Fixed Header ── */}
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #efe9e0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexShrink: 0 }}>
                <div>
                  <div style={{ color: colors.brand, fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}>Service Record</div>
                  <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.45rem", fontWeight: 500, color: colors.ink, lineHeight: 1.2 }}>{client.name}</h2>
                  <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.35rem", fontSize: "0.78rem", color: colors.muted }}>
                    <span>{formatDateTime(selectedHistory.scheduledAt)}</span>
                    <span>·</span>
                    {selectedHistory.status === "Completed" ? (
                      <span
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1"
                        style={{
                          background: "#eef2ec",
                          color: "#4a6b4a",
                          border: "1px solid rgba(167, 243, 208, 0.8)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          padding: "0.125rem 0.625rem",
                          borderRadius: "9999px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ width: "0.375rem", height: "0.375rem", borderRadius: "9999px", background: "#10b981", display: "inline-block" }}></span>
                        {selectedHistory.status}
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "0.1rem 0.55rem", borderRadius: "999px", fontSize: "0.68rem", fontWeight: 500, background: "#efe9e0", color: "#50463c", border: "1px solid #efe9e0" }}>{selectedHistory.status}</span>
                    )}
                    <span>·</span>
                    <span>{selectedHistory.serviceType || selectedHistory.pestConcern || client.pestConcern || "General Service"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setPrintRequest({
                      appointment: selectedHistory,
                      client,
                      technician: technician || null,
                      technicians: crewOf(selectedHistory).map((id) => accounts.find((account) => account.id === id)).filter(Boolean),
                      inventory,
                    })}
                    style={{ ...secondaryButton, display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.75rem", fontSize: "0.74rem" }}
                  >
                    <Printer size={14} /> Service form PDF
                  </button>
                  <button
                    type="button"
                    aria-label="Close service record"
                    onClick={() => setSelectedHistory(null)}
                    style={{ ...secondaryButton, padding: "0.45rem 0.6rem" }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* ── Scrollable Body ── */}
              <div style={{ overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* ── 1. Quick Metadata Top Row (4 micro-cards) ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.625rem", alignItems: "stretch" }}>
                  {/* Technician */}
                  <div style={{ padding: "0.625rem", background: "#efe9e0", border: "1px solid #efe9e0", borderRadius: "3.75px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <span style={{ display: "block", fontSize: "0.6rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Technician</span>
                    <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "#211b15", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={technicianName}>
                      {technicianName}
                    </span>
                  </div>
                  {/* Pest Concern */}
                  <div style={{ padding: "0.625rem", background: "#efe9e0", border: "1px solid #efe9e0", borderRadius: "3.75px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <span style={{ display: "block", fontSize: "0.6rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Pest Concern</span>
                    {(selectedHistory.pestConcern || client.pestConcern) ? (
                      <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "#211b15", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedHistory.pestConcern || client.pestConcern}>
                        {selectedHistory.pestConcern || client.pestConcern}
                      </span>
                    ) : (
                      <span style={{ display: "block", fontSize: "0.72rem", color: "#96897b", fontStyle: "italic", marginTop: "0.25rem" }}>
                        Not recorded
                      </span>
                    )}
                  </div>
                  {/* Follow-Up Date */}
                  <div style={{ padding: "0.625rem", background: "#efe9e0", border: "1px solid #efe9e0", borderRadius: "3.75px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <span style={{ display: "block", fontSize: "0.6rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Follow-Up Date</span>
                    {selectedHistory.followUpDate
                      ? <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "#211b15", marginTop: "0.25rem" }}>{selectedHistory.followUpDate}</span>
                      : <span style={{ display: "block", fontSize: "0.72rem", color: "#96897b", fontStyle: "italic", marginTop: "0.25rem" }}>No follow-up scheduled</span>
                    }
                  </div>
                  {/* Report Submitted */}
                  <div style={{ padding: "0.625rem", background: "#efe9e0", border: "1px solid #efe9e0", borderRadius: "3.75px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <span style={{ display: "block", fontSize: "0.58rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#96897b", whiteSpace: "nowrap" }}>Report Submitted</span>
                    {selectedHistory.reportSubmittedAt ? (
                      <div style={{ marginTop: "0.25rem", lineHeight: 1.35 }}>
                        <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "#211b15", whiteSpace: "nowrap" }}>
                          {formatDate(selectedHistory.reportSubmittedAt)}
                        </span>
                        <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 500, color: colors.muted, whiteSpace: "nowrap" }}>
                          {formatTime(selectedHistory.reportSubmittedAt)}
                        </span>
                      </div>
                    ) : (
                      <span style={{ display: "block", fontSize: "0.72rem", color: "#96897b", fontStyle: "italic", marginTop: "0.25rem" }}>
                        Not submitted
                      </span>
                    )}
                  </div>
                </div>

                {/* ── 2. Balanced 2-Column Section ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>

                  {/* LEFT: Service Location + Notes + Findings */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

                    {/* Service Location */}
                    <div style={{ paddingBottom: "0.9rem", borderBottom: "1px solid #efe9e0" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Service Location</div>
                      <div style={{ marginTop: "0.35rem", fontSize: "0.88rem", color: colors.body, lineHeight: 1.5 }}>
                        {selectedHistory.serviceLocation || client.address || <span style={{ color: colors.muted, fontStyle: "italic" }}>No address recorded.</span>}
                      </div>
                    </div>

                    {/* Appointment Notes */}
                    <div style={{ paddingTop: "0.9rem", paddingBottom: "0.9rem", borderBottom: "1px solid #efe9e0" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Appointment Notes</div>
                      <div style={{ marginTop: "0.3rem", fontSize: "0.84rem", color: colors.body, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {selectedHistory.notes || <span style={{ color: colors.muted, fontStyle: "italic" }}>No notes recorded.</span>}
                      </div>
                    </div>

                    {/* Inspection Findings */}
                    <div style={{ paddingTop: "0.9rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Inspection Findings</div>
                      <div style={{ marginTop: "0.3rem", fontSize: "0.84rem", color: colors.body, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {selectedHistory.report || <span style={{ color: colors.muted, fontStyle: "italic" }}>No findings recorded.</span>}
                      </div>
                    </div>

                  </div>

                  {/* RIGHT: Treatment + Materials + Recommendations */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0", borderLeft: "1px solid #efe9e0", paddingLeft: "1rem" }}>

                    {/* Treatment Performed */}
                    <div style={{ paddingBottom: "0.9rem", borderBottom: "1px solid #efe9e0" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Treatment Performed</div>
                      <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {treatmentMethods.length > 0 ? treatmentMethods.map((method, idx) => (
                          <span key={idx} style={{ display: "inline-flex", padding: "0.2rem 0.55rem", fontSize: "0.72rem", fontWeight: 500, background: idx === 0 ? "#f9ecea" : "#efe9e0", color: idx === 0 ? "#9a2d24" : "#50463c", border: `1px solid ${idx === 0 ? "#fecaca" : "#efe9e0"}`, borderRadius: "3.75px" }}>
                            {method}
                          </span>
                        )) : selectedHistory.treatmentPerformed ? (
                          <span style={{ fontSize: "0.84rem", color: colors.body }}>{selectedHistory.treatmentPerformed}</span>
                        ) : (
                          <span style={{ fontSize: "0.84rem", color: colors.muted, fontStyle: "italic" }}>No treatment recorded.</span>
                        )}
                      </div>
                    </div>

                    {/* Materials Used */}
                    {(selectedHistory.stockUsed || []).length > 0 && (
                      <div style={{ paddingTop: "0.9rem", paddingBottom: "0.9rem", borderBottom: "1px solid #efe9e0" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Materials Used</div>
                        <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {selectedHistory.stockUsed.map((item, idx) => (
                            <span key={idx} style={{ display: "inline-flex", alignItems: "center", padding: "0.2rem 0.55rem", fontSize: "0.72rem", background: "#fff", border: "1px solid #efe9e0", borderRadius: "3.75px", color: "#50463c" }}>
                              {item.name}:<strong style={{ marginLeft: "0.25rem", fontWeight: 500, color: "#211b15" }}>{item.amount} {item.unit}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    <div style={{ paddingTop: "0.9rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Recommendations</div>
                      <div style={{ marginTop: "0.3rem", fontSize: "0.84rem", lineHeight: 1.5 }}>
                        {selectedHistory.recommendations
                          ? <span style={{ color: colors.body }}>{selectedHistory.recommendations}</span>
                          : <span style={{ color: colors.muted, fontStyle: "italic" }}>No recommendations recorded.</span>
                        }
                      </div>
                    </div>

                  </div>
                </div>

                {/* Completion Confirmation */}
                {(selectedHistory.signaturePath || selectedHistory.technicianSignaturePath || selectedHistory.completionNote) && (
                  <div style={{ paddingTop: "1.1rem", paddingBottom: "1.1rem", borderBottom: "1px solid #efe9e0", background: selectedHistory.signaturePath ? "#eef2ec" : "#faf0e2", borderRadius: "3.75px", padding: "1rem", margin: "0.5rem 0" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>Completion Confirmation</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
                      <div>
                        <div style={{ color: "#96897b", fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase" }}>Client signature</div>
                        {selectedHistory.signaturePath ? (
                          <>
                            <div style={{ marginTop: "0.35rem", background: "#fff", borderRadius: "3.75px", padding: "0.4rem", display: "inline-block" }}>
                              <SignaturePreview url={signatureUrl} alt="Customer signature" name="Customer signature" />
                            </div>
                            <div style={{ marginTop: "0.4rem", color: "#4a6b4a", fontWeight: 500, fontSize: "0.82rem" }}>Signed by {selectedHistory.customerName || "the customer"}</div>
                            {selectedHistory.signedAt && <div style={{ color: colors.muted, fontSize: "0.72rem" }}>{formatDateTime(selectedHistory.signedAt)}</div>}
                          </>
                        ) : (
                          <>
                            <div style={{ marginTop: "0.3rem", color: "#9a3412", fontWeight: 500, fontSize: "0.82rem" }}>Completed without a customer signature</div>
                            <div style={{ marginTop: "0.2rem", color: colors.body, fontSize: "0.84rem", whiteSpace: "pre-wrap" }}>{selectedHistory.completionNote}</div>
                          </>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#96897b", fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase" }}>Technician signature</div>
                        {selectedHistory.technicianSignaturePath ? (
                          <>
                            <div style={{ marginTop: "0.35rem", background: "#fff", borderRadius: "3.75px", padding: "0.4rem", display: "inline-block" }}>
                              <SignaturePreview url={technicianSignatureUrl} alt="Technician signature" name="Technician signature" />
                            </div>
                            <div style={{ marginTop: "0.4rem", color: "#4a6b4a", fontWeight: 500, fontSize: "0.82rem" }}>Signed by {accounts.find((account) => account.id === selectedHistory.technicianId)?.name || accounts.find((account) => account.id === selectedHistory.technicianId)?.username || "the technician"}</div>
                            {selectedHistory.technicianSignedAt && <div style={{ color: colors.muted, fontSize: "0.72rem" }}>{formatDateTime(selectedHistory.technicianSignedAt)}</div>}
                          </>
                        ) : (
                          <div style={{ marginTop: "0.3rem", color: colors.muted, fontSize: "0.82rem", fontStyle: "italic" }}>No technician signature on file.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* This visit's photos and documents */}
                <div style={{ paddingTop: "1.1rem", paddingBottom: "1.1rem", borderBottom: "1px solid #efe9e0" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>
                    This visit&apos;s photos and documents{(selectedHistory.attachments || []).length > 0 && ` (${selectedHistory.attachments.length})`}
                  </div>
                  <HistoryFileList
                    files={selectedHistory.attachments || []}
                    onOpen={openHistoryAttachment}
                    onResolveUrl={getAttachmentUrl}
                    onRemove={handleRemoveVisitAttachment}
                    emptyMessage="No photos or documents were attached to this visit."
                  />
                </div>

                {/* General client documents */}
                <div style={{ paddingTop: "1.1rem" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#96897b" }}>
                    General client documents{(client.documents || []).length > 0 && ` (${client.documents.length})`}
                  </div>
                  <div style={{ marginTop: "0.2rem", color: colors.muted, fontSize: "0.72rem" }}>Client ID, contracts, and permits — not tied to this visit.</div>
                  <HistoryFileList
                    files={client.documents || []}
                    onOpen={openHistoryDocument}
                    onResolveUrl={onResolveDocumentUrl}
                    onRemove={canRemoveDocuments ? (doc) => onRemoveDocument?.(client.id, doc) : null}
                    emptyMessage="No general client documents on file."
                  />
                </div>

              </div>
            </section>
          </div>
        );
      })()}

      {isEditModalOpen && canEdit && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "7.5px",
              border: "1px solid #efe9e0",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
              width: "100%",
              maxWidth: "720px",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#96897b" }}>Client Details</div>
                <h3 style={{ margin: "0.25rem 0 0", color: "#211b15", fontSize: "1.4rem" }}>Edit Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "999px",
                  border: "1px solid #efe9e0",
                  background: "#ffffff",
                  color: "#50463c",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
                aria-label="Close edit profile modal"
              >
                <X size={18} />
              </button>
            </div>

            <ClientForm initialValues={client} onSubmit={async (values) => { const result = await onSave(values); if (result !== false) setIsEditModalOpen(false); }} submitLabel="Save Changes" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDetails;
