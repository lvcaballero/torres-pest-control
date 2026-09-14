// Full client profile: read-only summary, edit form, and documents.
//
// Sprint AC (View Single Client Profile): "Detail view displays full client
// information, classification, and attached documents" and "Staff can
// navigate back to the list or edit the profile from this view." Back
// navigation was missing entirely — the old page imported only useParams,
// with no Link anywhere.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PencilLine, Trash2, X } from "lucide-react";
import ClientForm from "./ClientForm";
import ClientDocuments from "./ClientDocuments";
import PageHeader from "../common/PageHeader";
import { formatDateTime, humanizeEnum } from "../../utils/formatters";
import { card, colors, pageShell } from "../../styles/theme";

const neutralCard = {
  ...card,
  borderTop: "none",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  background: "#ffffff",
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
  const overviewFields = useMemo(
    () => [
      { label: "Classification", value: client.classification === "OTHER" && client.classificationOther ? client.classificationOther : humanizeEnum(client.classification) },
      { label: "Pest Concern", value: client.pestConcern || "—" },
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
        eyebrow="Client Profile"
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
                  background: "#7f1d1d",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0.65rem 0.9rem",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  boxShadow: "0 10px 18px rgba(127, 17, 17, 0.12)",
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
                  background: "#fff1f2",
                  color: "#be123c",
                  border: "1px solid #fecdd3",
                  borderRadius: "10px",
                  padding: "0.65rem 0.9rem",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
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
                color: colors.brandInk,
                fontWeight: 700,
                textDecoration: "none",
                paddingTop: "0.15rem",
              }}
            >
              <ArrowLeft size={16} /> Back to Client Profiles
            </Link>
          </div>
        }
      />

      <section style={{ ...neutralCard, marginBottom: "1.5rem", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Client record</p>
            <h2 style={{ margin: "0.35rem 0 0", color: colors.ink, fontSize: "1.5rem", fontWeight: 700 }}>Profile overview</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
          {overviewFields.map((field) => (
            <div key={field.label} style={{ gridColumn: field.fullWidth ? "1 / -1" : "span 1" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                {field.label}
              </div>
              <div style={{ marginTop: "0.35rem", fontSize: "0.95rem", color: "#0f172a", fontWeight: 600, lineHeight: 1.5 }}>
                {field.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", fontSize: "0.74rem", color: "#64748b" }}>
          Created {formatDateTime(client.createdAt)} • Last updated {formatDateTime(client.updatedAt)}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        <div style={neutralCard}>
          <ClientDocuments
            documents={client.documents || []}
            canUpload={canUploadDocuments}
            canRemove={canRemoveDocuments}
            onUpload={onUploadDocument}
            onRemove={onRemoveDocument}
            onResolveUrl={onResolveDocumentUrl}
          />
        </div>
      </div>

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
              borderRadius: "20px",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
              width: "100%",
              maxWidth: "720px",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>Client Details</div>
                <h3 style={{ margin: "0.25rem 0 0", color: "#0f172a", fontSize: "1.4rem" }}>Edit Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "999px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569",
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
