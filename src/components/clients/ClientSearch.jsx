// Search box + classification filter.
//
// Sprint AC (View / Search Client Profiles): "Staff can search by name or
// filter by classification." The classification filter did not exist, and
// classification was deliberately excluded from the search string, so typing
// "COMMERCIAL" returned nothing.

import { clientClassificationOptions } from "../../utils/constants";
import { humanizeEnum } from "../../utils/formatters";
import { inputStyle } from "../../styles/theme";

function ClientSearch({
  searchTerm,
  onSearchChange,
  classification,
  onClassificationChange,
  status = "ACTIVE",
  onStatusChange,
}) {
  return (
    <div style={{ display: "flex", gap: "0.9rem", alignItems: "end", flexWrap: "wrap", padding: "1rem 1.25rem" }}>
      <div style={{ flex: "1 1 280px", minWidth: "220px" }}>
        <label style={labelStyle}>Search client</label>
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, phone, or email"
          style={inputStyle}
        />
      </div>

      <div style={{ flex: "0 0 220px" }}>
        <label style={labelStyle}>Classification</label>
        <select
          value={classification}
          onChange={(event) => onClassificationChange(event.target.value)}
          style={inputStyle}
        >
          <option value="ALL">All classifications</option>
          {clientClassificationOptions.map((option) => (
            <option key={option} value={option}>
              {humanizeEnum(option)}
            </option>
          ))}
        </select>
        </div>

      {onStatusChange && (
          <div style={{ flex: "0 0 190px" }}>
            <label style={labelStyle}>Status</label>
          <select value={status} onChange={(event) => onStatusChange(event.target.value)} style={inputStyle}>
            <option value="ACTIVE">Active only</option>
            <option value="ARCHIVED">Archived only</option>
            <option value="ALL">All (active + archived)</option>
          </select>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: "block",
  color: "#475569",
  fontSize: "0.75rem",
  fontWeight: 700,
  marginBottom: "0.45rem",
};

export default ClientSearch;
