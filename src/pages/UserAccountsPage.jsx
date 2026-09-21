import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

function UserAccountsPage({ users, onEditUser, onToggleUserStatus }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", role: "STAFF", status: "ACTIVE" });

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) => {
      const searchable = `${user.name || ""} ${user.username || ""} ${user.email || ""} ${user.role || ""}`.toLowerCase();
      return searchable.includes(term);
    });
  }, [users, searchTerm]);

  const startEdit = (user) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, role: user.role, status: user.status });
  };

  const handleSave = (userId) => {
    onEditUser?.(userId, {
      name: form.name,
      email: form.email,
      role: form.role,
      status: form.status,
    });
    setEditingId(null);
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ color: "#8b1e1e", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.72rem" }}>
          System Access
        </p>
        <h1 style={{ margin: "0.3rem 0 0", fontSize: "2.2rem", color: "#211b15", fontWeight: 500 }}>User Accounts</h1>
      </div>

      <div style={{ background: "#fcfaf1", border: "1px solid #efe9e0", borderRadius: "7.5px", padding: "1rem 1.25rem", boxShadow: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "block", fontWeight: 500, color: "#50463c", marginBottom: "0.5rem", flex: 1 }}>Search user</label>
          <Link
            to="/account"
            style={{ border: "none", background: "#7f1111", color: "#fff", borderRadius: "3.75px", padding: "0.8rem 1rem", fontWeight: 500, cursor: "pointer", textDecoration: "none", boxShadow: "none" }}
          >
            User Account Profile
          </Link>
        </div>

        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name, username, email, or role"
          style={{ width: "100%", border: "1px solid #efe9e0", borderRadius: "3.75px", padding: "0.85rem 0.9rem", fontSize: "0.96rem", boxShadow: "none" }}
        />

        <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
          {filteredUsers.length === 0 ? (
            <div style={{ padding: "1.25rem", background: "#efe9e0", borderRadius: "3.75px", color: "#96897b" }}>
              No users found.
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isEditing = editingId === user.id;

              return (
                <div key={user.id} style={{ border: "1px solid #efefef", borderRadius: "3.75px", padding: "1rem", display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "1.05rem", color: "#211b15" }}>{user.name}</div>
                      <div style={{ color: "#96897b", marginTop: "0.15rem" }}>{user.email}</div>
                    </div>
                    <span style={{ background: "#f9ecea", color: "#8b1e1e", borderRadius: "999px", padding: "0.35rem 0.7rem", fontWeight: 500, fontSize: "0.8rem" }}>
                      {user.role}
                    </span>
                  </div>

                  {isEditing ? (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                        <Field label="Name">
                          <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="Email">
                          <input type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="Role">
                          <select value={form.role} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))} style={inputStyle}>
                            <option value="ADMIN">ADMIN</option>
                            <option value="STAFF">STAFF</option>
                            <option value="TECHNICIAN">TECHNICIAN</option>
                          </select>
                        </Field>
                        <Field label="Status">
                          <select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))} style={inputStyle}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </Field>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => handleSave(user.id)} style={{ border: "none", background: "#7f1111", color: "#fff", borderRadius: "3.75px", padding: "0.75rem 1rem", fontWeight: 500, cursor: "pointer", boxShadow: "none" }}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} style={{ border: "1px solid #efe9e0", background: "#fff", color: "#211b15", borderRadius: "3.75px", padding: "0.75rem 1rem", fontWeight: 500, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                      <InfoRow label="Username" value={user.username} />
                      <InfoRow label="Status" value={user.status} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => startEdit(user)} style={{ border: "1px solid #efe9e0", background: "#fff", color: "#211b15", borderRadius: "3.75px", padding: "0.7rem 0.9rem", fontWeight: 500, cursor: "pointer" }}>
                      Edit User
                    </button>
                    <button type="button" onClick={() => onToggleUserStatus?.(user.id)} style={{ border: "none", background: user.status === "ACTIVE" ? "#50463c" : "#4a6b4a", color: "#fff", borderRadius: "3.75px", padding: "0.7rem 0.9rem", fontWeight: 500, cursor: "pointer", boxShadow: "none" }}>
                      {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: "0.45rem", color: "#50463c", fontWeight: 500 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ background: "#efe9e0", borderRadius: "3.75px", padding: "0.85rem 1rem", border: "1px solid #edf2f7" }}>
      <div style={{ fontSize: "0.8rem", color: "#96897b", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#211b15" }}>{value || "—"}</div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #efe9e0",
  borderRadius: "3.75px",
  padding: "0.75rem 0.8rem",
  fontSize: "0.96rem",
  background: "#ffffff",
  color: "#211b15",
  boxShadow: "none",
};

export default UserAccountsPage;
