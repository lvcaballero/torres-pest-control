import { Activity, BriefcaseBusiness, ShieldCheck, Users } from "lucide-react";

function MetricCard({ title, value, accent, Icon }) {
  return (
    <div style={{
      background: "#fcfaf1",
      border: "1px solid #efe9e0",
      borderRadius: "7.5px",
      padding: "1.25rem",
      boxShadow: "none",
      minHeight: "128px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.8rem", color: "#96897b", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{title}</span>
        <div style={{
          width: "42px",
          height: "42px",
          borderRadius: "7.5px",
          display: "grid",
          placeItems: "center",
          background: accent,
          color: "#ffffff",
          boxShadow: "none",
        }}>
          <Icon size={18} />
        </div>
      </div>
      <div style={{ fontSize: "2.1rem", fontWeight: 500, color: "#211b15", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function AdminDashboardPage({ users, clients, logs }) {
  const totalStaffAccounts = users.filter((user) => user.role !== "ADMIN").length;
  const activeAccounts = users.filter((user) => (user.status || "").toUpperCase() === "ACTIVE").length;
  const totalClients = clients.length;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ color: "#8b1e1e", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.72rem" }}>
          Overview
        </p>
        <h1 style={{ margin: "0.3rem 0 0", fontSize: "2.2rem", color: "#211b15", fontWeight: 500 }}>Admin Dashboard</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <MetricCard title="Total Staff Accounts" value={totalStaffAccounts} accent="#7f1111" Icon={Users} />
        <MetricCard title="Active Accounts" value={activeAccounts} accent="#4a6b4a" Icon={ShieldCheck} />
        <MetricCard title="Total Clients" value={totalClients} accent="#50463c" Icon={BriefcaseBusiness} />
      </div>

      <div style={{ background: "#fcfaf1", border: "1px solid #efe9e0", borderRadius: "7.5px", boxShadow: "none" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #efe9e0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "3.75px", display: "grid", placeItems: "center", background: "#7f1111", color: "#fff" }}>
            <Activity size={18} />
          </div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#211b15" }}>Recent Activity</h2>
        </div>

        <div style={{ padding: "1rem 1.5rem 1.5rem" }}>
          {logs.length === 0 ? (
            <p style={{ margin: 0, color: "#96897b" }}>No activity yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.85rem" }}>
              {logs.slice(0, 6).map((log) => (
                <div key={log.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.85rem 0.9rem", borderRadius: "3.75px", background: "#efe9e0", border: "1px solid #efe9e0" }}>
                  <div>
                    <div style={{ fontWeight: 500, color: "#211b15" }}>{log.actor}</div>
                    <div style={{ color: "#50463c", marginTop: "0.15rem" }}>{log.message}</div>
                  </div>
                  <div style={{ whiteSpace: "nowrap", color: "#96897b", fontSize: "0.8rem" }}>
                    {new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
