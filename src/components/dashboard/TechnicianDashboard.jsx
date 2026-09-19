// Technician view: what do I do next?
//
// This split is not cosmetic. Appointment reads are scoped per technician by
// the "Appointment read scope" policy in migration 030, so the shared dashboard
// was counting THEIR jobs and labelling the total "All records in system".
// Every figure here is explicitly about the signed-in technician.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useClients from "../../hooks/useClients";
import { useScheduling } from "../../context/SchedulingContext";
import { colors, pageShell, primaryButton } from "../../styles/theme";
import {
  completedToday,
  remainingToday,
  appointmentsToday,
  tomorrowsJobs,
} from "../../utils/dashboardMetrics";
import { greetingFor } from "../../utils/greetings";
import { Chip, Empty, JobRow, Panel, StatTile, TileRow, timeLabel } from "./DashboardParts";

function TechnicianDashboard() {
  const { currentUser } = useAuth();
  const { appointments, loading, error } = useScheduling();
  const { clients } = useClients();

  const me = currentUser?.id;
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const nameOf = (appointment) => clientsById.get(appointment.clientId)?.name || "Unknown client";
  const whereOf = (appointment) => {
    const client = clientsById.get(appointment.clientId);
    return appointment.serviceLocation || client?.address || "";
  };

  const mineToday = appointmentsToday(appointments).filter((entry) => entry.technicianId === me);
  const remaining = remainingToday(appointments, me);
  const done = completedToday(appointments, me);
  const tomorrow = tomorrowsJobs(appointments, me);
  const nextUp = remaining[0];

  const note = useMemo(() => {
    if (loading) return "Loading your schedule…";
    if (mineToday.length === 0) return "Nothing booked for you today.";
    if (remaining.length === 0) return "Every visit today is filed. Nice work.";
    if (remaining.length === 1) return "One visit left today.";
    return `${remaining.length} visits left today.`;
  }, [loading, mineToday.length, remaining.length]);

  return (
    <div style={pageShell}>
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ color: colors.brandInk, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Today
        </div>
        <h1 style={{ margin: "0.3rem 0 0", color: colors.ink, fontSize: "1.9rem", lineHeight: 1.15 }}>
          {greetingFor(currentUser?.name || currentUser?.username)}
        </h1>
        <p style={{ margin: "0.25rem 0 0", color: colors.muted, fontSize: "0.9rem" }}>{note}</p>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: "1rem", padding: "0.8rem 1rem", borderRadius: "12px", background: "#fdf0ef", border: "1px solid #eeb0ac", color: colors.danger, fontWeight: 700, fontSize: "0.85rem" }}>
          Couldn't load your schedule: {error}
        </div>
      )}

      <div style={{ display: "grid", gap: "1rem" }}>
        <TileRow>
          <StatTile
            label="Remaining today"
            value={loading ? "—" : remaining.length}
            note={nextUp ? `Next at ${timeLabel(nextUp.scheduledAt)}` : "Nothing left to file"}
            tone={remaining.length > 0 ? "attn" : "done"}
          />
          <StatTile
            label="Completed today"
            value={loading ? "—" : done.length}
            note={done.length > 0 ? "Reports filed" : "None filed yet"}
            tone="done"
          />
        </TileRow>

        <Panel title="My schedule today" action={new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}>
          {loading && mineToday.length === 0 && <Empty>Loading your schedule…</Empty>}
          {!loading && mineToday.length === 0 && <Empty>No visits booked for you today.</Empty>}
          {mineToday.map((appointment, index) => (
            <JobRow
              key={appointment.id}
              first={index === 0}
              when={timeLabel(appointment.scheduledAt)}
              title={nameOf(appointment)}
              detail={[whereOf(appointment), appointment.pestConcern].filter(Boolean).join(" · ")}
              action={appointment.reportSubmitted
                ? <Chip tone="done">Filed</Chip>
                : <Link to="/scheduling" style={{ ...primaryButton, textDecoration: "none", padding: "0.55rem 0.8rem", fontSize: "0.78rem", whiteSpace: "nowrap" }}>File Report</Link>}
            />
          ))}
        </Panel>

        <Panel title="Tomorrow, first three" action="Load the truck">
          {tomorrow.length === 0 && <Empty>Nothing booked for you tomorrow.</Empty>}
          {tomorrow.map((appointment, index) => (
            <JobRow
              key={appointment.id}
              first={index === 0}
              when={timeLabel(appointment.scheduledAt)}
              title={nameOf(appointment)}
              detail={[whereOf(appointment), appointment.pestConcern].filter(Boolean).join(" · ")}
            />
          ))}
        </Panel>
      </div>
    </div>
  );
}

export default TechnicianDashboard;
