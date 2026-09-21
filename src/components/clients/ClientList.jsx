// Client rows.
//
// Sprint AC: "List displays all client profiles with key info (name,
// classification, contact)" — classification was missing from the rows, it
// only appeared in the selected-client panel.
//
// Clicking a row navigates straight to the detail view. The old page needed
// two clicks: one to select, another on a separate "View Full Profile" link.

import { Link } from "react-router-dom";
import EmptyState from "../common/EmptyState";
import { humanizeEnum } from "../../utils/formatters";
import { badge, colors } from "../../styles/theme";

function ClientList({ clients, emptyMessage = "No client matches your search." }) {
  if (clients.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #efe9e0", borderRadius: "7.5px", boxShadow: "none", overflow: "hidden" }}>
      {clients.map((client) => (
        <Link
          key={client.id}
          to={`/clients/${client.id}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            textDecoration: "none",
            borderTop: "1px solid #efe9e0",
            background: "#ffffff",
            padding: "1rem 1.25rem",
            color: colors.body,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {client.reference && <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.72rem", fontWeight: 500, color: "#50463c", background: "#efe9e0", border: "1px solid #efe9e0", borderRadius: "3.75px", padding: "0.1rem 0.4rem", whiteSpace: "nowrap" }}>{client.reference}</span>}
              <span style={{ fontWeight: 500 }}>{client.name || "(unnamed client)"}</span>
            </div>
            <div style={{ fontSize: "0.85rem", color: colors.muted, marginTop: "0.15rem" }}>
              {client.phone || "No phone"} • {client.email || "No email"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            {client.status === "ARCHIVED" && (
              <span style={{ ...badge, background: "#f9ecea", color: "#9a2d24" }}>Archived</span>
            )}
            <span style={badge}>{humanizeEnum(client.classification)}</span>
            {client.documents?.length > 0 && (
              <span style={{ ...badge, background: "#efe9e0", color: "#50463c" }}>
                {client.documents.length} doc{client.documents.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default ClientList;
