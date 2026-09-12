// Single client profile route (/clients/:id).

import { Link, useNavigate, useParams } from "react-router-dom";
import ClientDetails from "../components/clients/ClientDetails";
import PageHeader from "../components/common/PageHeader";
import useAuth from "../hooks/useAuth";
import useClients from "../hooks/useClients";
import { useToast } from "../context/ToastContext";
import { SUBSYSTEMS } from "../utils/permissions";
import { card, colors, pageShell } from "../styles/theme";

function ClientDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const { getClient, updateClient, archiveClient, restoreClient, addDocument, removeDocument, getDocumentUrl, loading } =
    useClients();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const client = getClient(id);

  // Clients load asynchronously now, so an absent client during the initial
  // fetch is "not loaded yet", not "not found".
  if (!client && loading) {
    return (
      <div style={pageShell}>
        <div style={{ ...card, color: colors.muted }}>Loading client…</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={pageShell}>
        <PageHeader eyebrow="Client Profile" title="Client not found" />
        <div style={card}>
          <p style={{ margin: "0 0 1rem", color: colors.muted }}>
            That client profile doesn't exist, or it was deleted.
          </p>
          <Link to="/clients" style={{ color: colors.brandInk, fontWeight: 700 }}>
            Back to Client Profiles
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async (form) => {
    const result = await updateClient(client.id, form);
    if (result === true) showSuccess("Client profile updated.");
    else showError(result);
  };

  const handleUpload = (file) => addDocument(client.id, file);
  const handleRemove = (document) => removeDocument(client.id, document);

  const handleArchive = async () => {
    if (!window.confirm(`Archive ${client.name}? Their history and documents will be preserved, and this can be undone later.`)) return;
    const result = await archiveClient(client.id);
    if (result === true) {
      showSuccess("Client profile archived.");
      navigate("/clients");
    } else {
      showError(result);
    }
  };

  const handleRestore = async () => {
    const result = await restoreClient(client.id);
    if (result === true) showSuccess("Client profile restored.");
    else showError(result);
  };

  return (
    <ClientDetails
      client={client}
      canEdit={can(SUBSYSTEMS.CLIENTS, "edit")}
      canArchive={can(SUBSYSTEMS.CLIENTS, "delete")}
      canUploadDocuments={can(SUBSYSTEMS.CLIENT_DOCUMENTS, "create")}
      canRemoveDocuments={can(SUBSYSTEMS.CLIENT_DOCUMENTS, "delete")}
      onSave={handleSave}
      onArchive={handleArchive}
      onRestore={handleRestore}
      onUploadDocument={handleUpload}
      onRemoveDocument={handleRemove}
      onResolveDocumentUrl={getDocumentUrl}
    />
  );
}

export default ClientDetailPage;
