// Office view, shared by admin and staff.
//
// One file rather than two: "Pending / Unscheduled" and "Needs Scheduling" are
// the same count, and "Technician Workload" and "Today's Overview" answer the
// same question, so a separate admin file would have been a near-duplicate to
// keep in sync. The genuinely admin-only panels are gated inline instead.
//
// On money: the schema records what the business SPENDS and never what it
// CHARGES — there is no price, fee or invoice column anywhere — so the cost
// panel is deliberately named for what it is. Revenue and margin need a pricing
// feature first, not a dashboard panel.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useClients from "../../hooks/useClients";
import useUsers from "../../hooks/useUsers";
import { useScheduling } from "../../context/SchedulingContext";
import { useInventoryContext } from "../../context/InventoryContext";
import { ROLES } from "../../utils/constants";
import { dashboardNote, greetingFor } from "../../utils/greetings";
import { colors, pageShell, primaryButton, secondaryButton } from "../../styles/theme";
import {
  appointmentsToday,
  averageMaterialCost,
  awaitingReschedule,
  lowStockItems,
  needsScheduling,
  peso,
  pesoCompact,
  recentlyCompleted,
  reorderExposure,
  serviceMixThisMonth,
  spendBySupplier,
  spendThisMonth,
  stockOnHandValue,
  workloadToday,
} from "../../utils/dashboardMetrics";
import {
  Chip, Empty, JobRow, Panel, RankedBars, StatTile, TileRow, dateLabel, timeLabel,
} from "./DashboardParts";

function OfficeDashboard() {
  const { currentUser } = useAuth();
  const { appointments, loading, error } = useScheduling();
  const { clients } = useClients();
  const { users } = useUsers();
  const { inventory, movements } = useInventoryContext();

  const isAdmin = currentUser?.role === ROLES.ADMIN;
  const note = useMemo(() => dashboardNote(), []);

  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const nameOf = (appointment) => clientsById.get(appointment.clientId)?.name || "Unknown client";
  const technicians = users.filter((user) => user.role === ROLES.TECHNICIAN);
  const techName = (id) => {
    const match = users.find((user) => user.id === id);
    return match?.name || match?.username || "Unassigned";
  };

  const today = appointmentsToday(appointments);
  const unscheduled = needsScheduling(appointments);
  const toRebook = awaitingReschedule(appointments);
  const lowStock = lowStockItems(inventory);
  const actionItems = [...unscheduled, ...toRebook].slice(0, 6);

  const workload = workloadToday(appointments, technicians);
  const serviceMix = serviceMixThisMonth(appointments);
  const completed = recentlyCompleted(appointments);

  const monthSpend = spendThisMonth(movements);
  const onHand = stockOnHandValue(inventory);
  const exposure = reorderExposure(inventory);
  const materials = averageMaterialCost(appointments, inventory);
  const suppliers = spendBySupplier(movements, inventory);

  return (
    <div style={pageShell}>
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ color: colors.brandInk, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Overview
        </div>
        <h1 style={{ margin: "0.3rem 0 0", color: colors.ink, fontSize: "1.9rem", lineHeight: 1.15 }}>
          {greetingFor(currentUser?.name || currentUser?.username)}
        </h1>
        <p style={{ margin: "0.25rem 0 0", color: colors.muted, fontSize: "0.9rem" }}>{note}</p>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: "1rem", padding: "0.8rem 1rem", borderRadius: "12px", background: "#fdf0ef", border: "1px solid #eeb0ac", color: colors.danger, fontWeight: 700, fontSize: "0.85rem" }}>
          Couldn't load appointments: {error}
        </div>
      )}

      <div style={{ display: "grid", gap: "1rem" }}>
        <TileRow>
          <StatTile
            label="Needs scheduling"
            value={loading ? "—" : unscheduled.length}
            note="Pending, no technician"
            tone={unscheduled.length > 0 ? "crit" : "done"}
          />
          <StatTile
            label="To reschedule"
            value={loading ? "—" : toRebook.length}
            note="Awaiting a new slot"
            tone={toRebook.length > 0 ? "attn" : "done"}
          />
          <StatTile
            label="Today's jobs"
            value={loading ? "—" : today.length}
            note={`Across ${technicians.length} technician${technicians.length === 1 ? "" : "s"}`}
          />
          <StatTile
            label="Low stock"
            value={lowStock.length}
            note="At or below reorder level"
            tone={lowStock.length > 0 ? "attn" : "done"}
          />
        </TileRow>

        <Panel title="Action required" action={<Link to="/scheduling" style={{ color: colors.brand, textDecoration: "none" }}>Open Scheduling →</Link>}>
          {actionItems.length === 0 && <Empty>Nothing waiting. Every visit has a technician and a slot.</Empty>}
          {actionItems.map((appointment, index) => (
            <JobRow
              key={appointment.id}
              first={index === 0}
              when={dateLabel(appointment.scheduledAt)}
              title={`${nameOf(appointment)} — ${appointment.pestConcern || "Service"}`}
              detail={appointment.status === "Reschedule"
                ? "Reschedule · needs a new slot"
                : "Pending · no technician assigned"}
              action={(
                <Link
                  to="/scheduling"
                  style={{
                    ...(appointment.status === "Reschedule" ? secondaryButton : primaryButton),
                    textDecoration: "none", padding: "0.5rem 0.75rem", fontSize: "0.76rem", whiteSpace: "nowrap",
                  }}
                >
                  {appointment.status === "Reschedule" ? "Rebook" : "Assign"}
                </Link>
              )}
            />
          ))}
        </Panel>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <Panel title="Who's where today">
            {workload.length === 0
              ? <Empty>No technicians on the books.</Empty>
              : <RankedBars rows={workload.map((row) => ({ label: row.name, value: row.count }))}
                            format={(value) => `${value} job${value === 1 ? "" : "s"}`} />}
          </Panel>

          <Panel title="Services this month">
            <RankedBars rows={serviceMix.map((row) => ({ label: row.label, value: row.count }))} />
          </Panel>
        </div>

        {/* Cost, not revenue — see the note at the top of this file. */}
        <Panel title="Cost &amp; stock" action="This month">
          {/* Compact figures with the exact amount on hover: a peso total has no
              fixed width, and the full number did not fit the tile. */}
          <TileRow min="150px">
            <StatTile label="Stock received" value={pesoCompact(monthSpend)} title={peso(monthSpend, { decimals: 2 })} note="Recorded on Stock In" />
            <StatTile label="Stock on hand" value={pesoCompact(onHand)} title={peso(onHand, { decimals: 2 })} note="Quantity × unit cost" />
            <StatTile
              label="Restock cost"
              value={pesoCompact(exposure)}
              title={peso(exposure, { decimals: 2 })}
              note="To clear every low item"
              tone={exposure > 0 ? "attn" : "done"}
            />
            <StatTile
              label="Materials per job"
              value={pesoCompact(materials.average)}
              title={peso(materials.average, { decimals: 2 })}
              note={materials.jobs > 0 ? `Est. across ${materials.jobs} job${materials.jobs === 1 ? "" : "s"}` : "No jobs filed yet"}
            />
          </TileRow>

          {isAdmin && (
            <div style={{ marginTop: "0.5rem", paddingTop: "0.85rem", borderTop: "1px solid #f3eaea" }}>
              <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.8rem", fontWeight: 800, color: colors.body }}>
                Spend by supplier
              </h3>
              <RankedBars rows={suppliers} format={(value) => pesoCompact(value)} />
            </div>
          )}

          <p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: colors.muted, fontStyle: "italic" }}>
            Materials per job is an estimate: a stock-out records the quantity used, not what it
            cost that day, so it is priced at each item's current cost.
          </p>
        </Panel>

        {lowStock.length > 0 && (
          <Panel title="Running low" action={<Link to="/inventory" style={{ color: colors.brand, textDecoration: "none" }}>Open Inventory →</Link>}>
            {lowStock.slice(0, 5).map((item, index) => (
              <JobRow
                key={item.id}
                first={index === 0}
                when={`${item.quantity} ${item.unit || ""}`.trim()}
                title={item.name}
                detail={`Reorder level ${item.reorderLevel}${item.supplier ? ` · ${item.supplier}` : ""}`}
                action={<Chip tone="attn">Low</Chip>}
              />
            ))}
          </Panel>
        )}

        {isAdmin && (
          <Panel title="Recently completed">
            {completed.length === 0 && <Empty>No reports filed yet.</Empty>}
            {completed.map((appointment, index) => (
              <JobRow
                key={appointment.id}
                first={index === 0}
                when={dateLabel(appointment.reportSubmittedAt || appointment.scheduledAt)}
                title={`${nameOf(appointment)} — ${appointment.pestConcern || "Service"}`}
                detail={`${techName(appointment.technicianId)}${appointment.customerName ? ` · signed by ${appointment.customerName}` : " · no signature on file"}`}
                action={appointment.signaturePath
                  ? <Chip tone="done">Signed</Chip>
                  : <Chip tone="attn">Unsigned</Chip>}
              />
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}

export default OfficeDashboard;
