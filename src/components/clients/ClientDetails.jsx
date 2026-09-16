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
import { useScheduling } from "../../context/SchedulingContext";
import { formatDateTime, humanizeEnum } from "../../utils/formatters";
import { colors, dangerButton, pageShell, primaryButton, secondaryButton } from "../../styles/theme";

const neutralCard = {
  background: "#ffffff",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "18px",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.03)",
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
  const { appointments } = useScheduling();
  const serviceHistory = appointments
    .filter((appointment) => appointment.clientId === client.id && appointment.status === "Completed")
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
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
                paddingTop: "0.15rem",
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
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Client record</p>
            <h2 style={{ margin: "0.35rem 0 0", color: colors.ink, fontSize: "1.2rem", fontWeight: 800 }}>Profile overview</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
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
        <section style={{ ...neutralCard, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Client history</p>
              <h2 style={{ margin: "0.35rem 0 0", color: colors.ink, fontSize: "1.2rem" }}>Service history</h2>
            </div>
            <span style={{ color: colors.muted, fontSize: "0.8rem" }}>{serviceHistory.length} appointment{serviceHistory.length === 1 ? "" : "s"}</span>
          </div>
          {serviceHistory.length === 0 ? (
            <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: "10px", background: "#f8fafc", color: colors.muted, fontSize: "0.85rem" }}>No service history recorded yet.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
              {serviceHistory.map((appointment) => (
                <article key={appointment.id} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "0.9rem", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <strong style={{ color: colors.ink }}>{formatDateTime(appointment.scheduledAt)}</strong>
                    <span style={{ color: colors.brandInk, background: "#fef2f2", borderRadius: "999px", padding: "0.25rem 0.55rem", fontSize: "0.7rem", fontWeight: 800 }}>{appointment.status}</span>
                  </div>
                  {appointment.notes && <p style={{ margin: "0.55rem 0 0", color: colors.body, fontSize: "0.84rem" }}>{appointment.notes}</p>}
                  {appointment.report && <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid #f1f5f9" }}><div style={{ color: colors.muted, fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase" }}>Inspection and treatment report</div><div style={{ marginTop: "0.25rem", color: colors.body, fontSize: "0.84rem", lineHeight: 1.5 }}>{appointment.report}</div></div>}
                  {(appointment.stockUsed || []).length > 0 && <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid #f1f5f9" }}><div style={{ color: colors.muted, fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase" }}>Materials used</div><div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.35rem" }}>{appointment.stockUsed.map((entry, index) => <span key={`${entry.itemId}-${index}`} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.3rem 0.45rem", color: colors.body, fontSize: "0.75rem" }}>{entry.name}: {entry.amount} {entry.unit}</span>)}</div></div>}
                </article>
              ))}
            </div>
          )}
        </section>
        <div style={{ ...neutralCard, padding: "1rem 1.25rem" }}>
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
