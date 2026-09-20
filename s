[1mdiff --git a/src/components/dashboard/TechnicianDashboard.jsx b/src/components/dashboard/TechnicianDashboard.jsx[m
[1mindex fac5532..405954c 100644[m
[1m--- a/src/components/dashboard/TechnicianDashboard.jsx[m
[1m+++ b/src/components/dashboard/TechnicianDashboard.jsx[m
[36m@@ -12,10 +12,10 @@[m [mimport useClients from "../../hooks/useClients";[m
 import { useScheduling } from "../../context/SchedulingContext";[m
 import { colors, pageShell, primaryButton } from "../../styles/theme";[m
 import {[m
[32m+[m[32m  appointmentsThisWeek,[m
   completedToday,[m
   remainingToday,[m
   appointmentsToday,[m
[31m-  tomorrowsJobs,[m
 } from "../../utils/dashboardMetrics";[m
 import { greetingFor } from "../../utils/greetings";[m
 import { Chip, Empty, JobRow, Panel, StatTile, TileRow, timeLabel } from "./DashboardParts";[m
[36m@@ -36,8 +36,12 @@[m [mfunction TechnicianDashboard() {[m
   const mineToday = appointmentsToday(appointments).filter((entry) => entry.technicianId === me);[m
   const remaining = remainingToday(appointments, me);[m
   const done = completedToday(appointments, me);[m
[31m-  const tomorrow = tomorrowsJobs(appointments, me);[m
   const nextUp = remaining[0];[m
[32m+[m[32m  const weeklyJobs = appointmentsThisWeek(appointments).filter((entry) => entry.technicianId === me);[m
[32m+[m[32m  const weeklyFiled = weeklyJobs.filter((entry) => entry.reportSubmitted).length;[m
[32m+[m[32m  const nextScheduled = appointments[m
[32m+[m[32m    .filter((entry) => entry.technicianId === me && entry.status !== "Cancelled" && new Date(entry.scheduledAt) >= new Date())[m
[32m+[m[32m    .sort((first, second) => new Date(first.scheduledAt) - new Date(second.scheduledAt))[0];[m
 [m
   const note = useMemo(() => {[m
     if (loading) return "Loading your schedule…";[m
[36m@@ -81,6 +85,22 @@[m [mfunction TechnicianDashboard() {[m
           />[m
         </TileRow>[m
 [m
[32m+[m[32m        <Panel title="Field summary" action="This week">[m
[32m+[m[32m          <TileRow min="145px">[m
[32m+[m[32m            <StatTile label="Scheduled this week" value={loading ? "—" : weeklyJobs.length} note="Assigned visits" />[m
[32m+[m[32m            <StatTile label="Reports filed" value={loading ? "—" : weeklyFiled} note="Completed reports" tone="done" />[m
[32m+[m[32m            <StatTile label="Reports to file" value={loading ? "—" : weeklyJobs.length - weeklyFiled} note="Visits still open" tone={weeklyJobs.length - weeklyFiled > 0 ? "attn" : "done"} />[m
[32m+[m[32m          </TileRow>[m
[32m+[m[32m          {nextScheduled ? ([m
[32m+[m[32m            <div style={{ padding: "0.8rem", borderRadius: "10px", background: "#fff7ed", border: "1px solid #fed7aa" }}>[m
[32m+[m[32m              <div style={{ color: "#9a3412", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next scheduled visit</div>[m
[32m+[m[32m              <div style={{ marginTop: "0.25rem", color: colors.ink, fontSize: "0.92rem", fontWeight: 800 }}>{nameOf(nextScheduled)}</div>[m
[32m+[m[32m              <div style={{ marginTop: "0.2rem", color: colors.body, fontSize: "0.78rem" }}>{new Date(nextScheduled.scheduledAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {nextScheduled.durationMinutes || 60} minutes</div>[m
[32m+[m[32m              <div style={{ marginTop: "0.15rem", color: colors.muted, fontSize: "0.75rem" }}>{whereOf(nextScheduled) || "No service address recorded."}</div>[m
[32m+[m[32m            </div>[m
[32m+[m[32m          ) : <Empty>No upcoming visit is scheduled.</Empty>}[m
[32m+[m[32m        </Panel>[m
[32m+[m
         <Panel title="My schedule today" action={new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}>[m
           {loading && mineToday.length === 0 && <Empty>Loading your schedule…</Empty>}[m
           {!loading && mineToday.length === 0 && <Empty>No visits booked for you today.</Empty>}[m
[36m@@ -98,18 +118,6 @@[m [mfunction TechnicianDashboard() {[m
           ))}[m
         </Panel>[m
 [m
[31m-        <Panel title="Tomorrow, first three" action="Load the truck">[m
[31m-          {tomorrow.length === 0 && <Empty>Nothing booked for you tomorrow.</Empty>}[m
[31m-          {tomorrow.map((appointment, index) => ([m
[31m-            <JobRow[m
[31m-              key={appointment.id}[m
[31m-              first={index === 0}[m
[31m-              when={timeLabel(appointment.scheduledAt)}[m
[31m-              title={nameOf(appointment)}[m
[31m-              detail={[whereOf(appointment), appointment.pestConcern].filter(Boolean).join(" · ")}[m
[31m-            />[m
[31m-          ))}[m
[31m-        </Panel>[m
       </div>[m
     </div>[m
   );[m
