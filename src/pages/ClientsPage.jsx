// Client list + search route.

import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/common/PageHeader";
import ClientSearch from "../components/clients/ClientSearch";
import ClientList from "../components/clients/ClientList";
import EmptyState from "../components/common/EmptyState";
import useAuth from "../hooks/useAuth";
import useClients from "../hooks/useClients";
import { SUBSYSTEMS } from "../utils/permissions";
import { colors, pageShell, primaryButton } from "../styles/theme";

function ClientsPage() {
  const { can } = useAuth();
  const { clients, filter, loading, error } = useClients();
  const [searchTerm, setSearchTerm] = useState("");
  const [classification, setClassification] = useState("ALL");
  // Archived clients are kept out of the default view (they're inactive
  // records, not deleted ones) but stay one dropdown away for anyone who
  // needs to find or restore one.
  const [status, setStatus] = useState("ACTIVE");

  // Filtering is a pure function in clientService, so an empty result is
  // genuinely empty. The old page fell back to `|| clients[0]`, which made
  // the "no match" state unreachable and showed an unrelated client instead.
  const visibleClients = filter({ searchTerm, classification, status });

  return (
    <div style={pageShell}>
      <PageHeader
        eyebrow="Client Management"
        title="Client Profiles"
        actions={
          can(SUBSYSTEMS.CLIENTS, "create") && (
            <Link to="/clients/new" style={{ ...primaryButton, textDecoration: "none", display: "inline-block" }}>
              Create Client Profile
            </Link>
          )
        }
      />

      <div style={{ background: "#ffffff", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: "18px", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.03)", marginBottom: "1rem", overflow: "hidden" }}>
        <ClientSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          classification={classification}
          onClassificationChange={setClassification}
          status={status}
          onStatusChange={setStatus}
        />
        <div style={{ padding: "0.7rem 1.25rem", borderTop: "1px solid #f1f5f9", background: "#f8fafc", color: colors.muted, fontSize: "0.78rem" }}>
          Showing {visibleClients.length} of {clients.length} client
          {clients.length === 1 ? "" : "s"}.
        </div>
      </div>

      {error ? (
        <EmptyState message={`Could not load clients — ${error}`} />
      ) : loading ? (
        <EmptyState message="Loading clients…" />
      ) : (
        <ClientList clients={visibleClients} />
      )}
    </div>
  );
}

export default ClientsPage;
