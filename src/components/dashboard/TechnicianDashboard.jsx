// Technician view: "Your day". Built for the phone first (the handoff's
// Today screen) and centred in a narrow column on a desktop.
//
//   - progress through the day: done, to go, and roughly how much work is left;
//   - the Up next card on dark olive: where, what, the site note, Directions,
//     Call site, and the one big action — Start visit (amber, because maroon
//     disappears on olive), or Continue once it is under way;
//   - Later today, then Done (with a "Sign" nudge where the customer has not
//     signed), then any reports still owed from earlier this week.
//
// Appointment reads are scoped to the signed-in technician by migration 030,
// so every figure here is theirs.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bug, MapPin, Navigation, Phone } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import useClients from "../../hooks/useClients";
import useUsers from "../../hooks/useUsers";
import useNow from "../../hooks/useNow";
import { useScheduling } from "../../context/SchedulingContext";
import { useToast } from "../../context/ToastContext";
import { accent, brand, font, neutral, radius, status as semantic, surface, weight } from "../../styles/tokens";
import { colors } from "../../styles/theme";
import StatusPill from "../ui/StatusPill";
import { crewOf } from "../../utils/scheduling";
import { reportsDue } from "../../utils/dashboardMetrics";
import { directionsUrl, telUrl } from "../../utils/clientTimeline";
import { canStart, dayPlan, isDone, leadsCrew, workLeftLabel } from "../../utils/techDay";
import { formatDuration } from "../../utils/calendarDates";

const clock = (value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const firstName = (user) => (user?.name || user?.username || "").split(" ")[0];

const sectionLabel = {
  margin: "22px 0 4px",
  fontSize: "11.5px",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: neutral.saddle,
};

function VisitRow({ time, title, detail, badge, to }) {
  const [hm, ampm] = time.split(" ");
  return (
    <li style={{ borderBottom: `1px solid ${colors.line}` }}>
      <Link to={to} style={{ display: "grid", gridTemplateColumns: "58px minmax(0, 1fr) auto", gap: "12px", alignItems: "center", padding: "14px 0", color: "inherit", textDecoration: "none" }}>
        <span style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
          <span style={{ display: "block", color: neutral.ink, fontWeight: weight.medium }}>{hm}</span>
          <span style={{ display: "block", color: neutral.bark, fontSize: "12px" }}>{ampm}</span>
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", font: `500 17px/1.3 ${font.display}`, color: neutral.ink }}>{title}</span>
          <span style={{ display: "block", color: neutral.saddle, fontSize: "13px" }}>{detail}</span>
        </span>
        {badge}
      </Link>
    </li>
  );
}

const darkButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "46px",
  borderRadius: radius.control,
  border: "1px solid rgba(252, 250, 241, 0.35)",
  color: surface.canvas,
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: weight.medium,
};

function UpNextCard({ appointment, client, crewNames, me, onStart, starting, now }) {
  const inProgress = appointment.status === "In progress";
  const startable = canStart(appointment, now);
  const address = appointment.serviceLocation || client?.address || "";
  const tel = telUrl(client?.phone);
  const others = crewNames.filter((name) => name !== me);

  return (
    <section
      aria-label="Up next"
      style={{ background: surface.inverted, color: surface.canvas, borderRadius: radius.card, padding: "20px 20px 22px", marginTop: "16px" }}
    >
      <p style={{ margin: 0, fontSize: "11.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: accent.wheat }}>
        {inProgress ? "In progress" : "Up next"} · {clock(appointment.scheduledAt)}
        {others.length ? ` · with ${others.join(", ")}` : ""}
      </p>
      <h2 style={{ margin: "8px 0 10px", font: `500 26px/1.2 ${font.display}`, color: surface.canvas }}>{client?.name || "Visit"}</h2>
      {address && (
        <p style={{ margin: "0 0 6px", display: "flex", gap: "8px", alignItems: "flex-start", color: "rgba(252, 250, 241, 0.85)" }}>
          <MapPin size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
          {address}
        </p>
      )}
      <p style={{ margin: 0, display: "flex", gap: "8px", alignItems: "flex-start", color: "rgba(252, 250, 241, 0.85)" }}>
        <Bug size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
        {[appointment.pestConcern, appointment.serviceType, formatDuration(appointment.durationMinutes || 60)].filter(Boolean).join(" · ")}
      </p>
      {client?.serviceNotes && (
        <p style={{ margin: "14px 0 0", padding: "10px 12px", borderRadius: "4px", background: "rgba(252, 250, 241, 0.08)", color: surface.canvas, fontSize: "14px", lineHeight: 1.5 }}>
          <b style={{ fontWeight: 600 }}>Site note:</b> {client.serviceNotes}
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px" }}>
        {address ? (
          <a href={directionsUrl(address)} target="_blank" rel="noopener noreferrer" style={darkButton}>
            <Navigation size={17} aria-hidden="true" /> Directions
          </a>
        ) : (
          <span style={{ ...darkButton, opacity: 0.4 }}>No address</span>
        )}
        {tel ? (
          <a href={tel} style={darkButton}>
            <Phone size={17} aria-hidden="true" /> Call site
          </a>
        ) : (
          <span style={{ ...darkButton, opacity: 0.4 }}>No phone</span>
        )}
      </div>
      {(inProgress || startable) && (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          style={{
            marginTop: "10px",
            width: "100%",
            minHeight: "54px",
            border: 0,
            borderRadius: radius.control,
            background: accent.amber,
            color: neutral.ink,
            fontSize: "17px",
            fontWeight: weight.medium,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            cursor: starting ? "default" : "pointer",
            opacity: starting ? 0.7 : 1,
          }}
        >
          {starting ? "Starting…" : inProgress ? "Continue visit" : "Start visit"} <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function TechnicianDashboard() {
  const { currentUser } = useAuth();
  const { appointments, loading, error, startVisit } = useScheduling();
  const { clients } = useClients();
  const { users } = useUsers();
  const { showError } = useToast();
  const navigate = useNavigate();
  const now = useNow(60000);
  const [starting, setStarting] = useState(false);

  const me = currentUser?.id;
  const myName = currentUser?.name || currentUser?.username || "";
  const clientOf = (appointment) => clients.find((client) => client.id === appointment.clientId);
  const nameOf = (id) => {
    const person = users.find((user) => user.id === id);
    return person?.name || person?.username || "";
  };

  const plan = dayPlan(appointments, me, now);
  const { today, done, upNext, later, minutesLeft } = plan;
  const owed = reportsDue(appointments, me, now).filter((entry) => !today.includes(entry));

  const handleStart = async () => {
    if (!upNext) return;
    if (upNext.status === "In progress") {
      navigate(`/visit/${upNext.id}`);
      return;
    }
    setStarting(true);
    const result = await startVisit(upNext.id);
    setStarting(false);
    if (result !== true) {
      showError(result);
      return;
    }
    navigate(`/visit/${upNext.id}`);
  };

  const summary = loading
    ? "Loading your schedule…"
    : today.length === 0
      ? "Nothing booked for you today."
      : [`${done.length} done`, `${today.length - done.length} to go`, workLeftLabel(minutesLeft)].filter(Boolean).join(" · ");

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <p style={{ margin: 0, fontSize: "11.5px", letterSpacing: "0.09em", textTransform: "uppercase", color: neutral.saddle }}>
        {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
      </p>
      <h1 style={{ margin: "4px 0 0", font: `500 30px/1.2 ${font.display}`, letterSpacing: "-0.33px" }}>
        Your day{firstName(currentUser) ? `, ${firstName(currentUser)}` : ""}
      </h1>
      <p style={{ margin: "8px 0 0", color: neutral.saddle }}>{summary}</p>

      {today.length > 0 && (
        <div role="img" aria-label={`${done.length} of ${today.length} visits done`} style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
          {today.map((entry) => (
            <span
              key={entry.id}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: isDone(entry) ? semantic.success : entry === upNext ? brand.base : surface.sunken,
              }}
            />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" style={{ margin: "16px 0 0", padding: "10px 12px", borderRadius: radius.control, background: semantic.dangerSurface, color: semantic.danger }}>
          Couldn't load your schedule: {error}
        </p>
      )}

      {upNext && (
        <UpNextCard
          appointment={upNext}
          client={clientOf(upNext)}
          crewNames={crewOf(upNext).map(nameOf).filter(Boolean)}
          me={myName}
          onStart={handleStart}
          starting={starting}
          now={now}
        />
      )}

      {later.length > 0 && (
        <>
          <p style={sectionLabel}>Later today</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {later.map((entry) => {
              const others = crewOf(entry).map(nameOf).filter((name) => name && name !== myName);
              return (
                <VisitRow
                  key={entry.id}
                  time={clock(entry.scheduledAt)}
                  title={clientOf(entry)?.name || "Visit"}
                  detail={[entry.pestConcern || entry.serviceType, others.length ? `with ${others.join(", ")}` : formatDuration(entry.durationMinutes || 60)].filter(Boolean).join(" · ")}
                  badge={leadsCrew(entry, me) ? <StatusPill tone="brand">Lead</StatusPill> : null}
                  to={`/scheduling?appointment=${encodeURIComponent(entry.id)}`}
                />
              );
            })}
          </ul>
        </>
      )}

      {done.length > 0 && (
        <>
          <p style={sectionLabel}>Done</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {done.map((entry) => {
              const unsigned = !entry.signaturePath;
              return (
                <VisitRow
                  key={entry.id}
                  time={clock(entry.scheduledAt)}
                  title={clientOf(entry)?.name || "Visit"}
                  detail={entry.reportSubmitted ? (unsigned ? "Report filed · awaiting signature" : "Report filed · signed") : "Completed"}
                  badge={unsigned && entry.reportSubmitted ? <StatusPill tone="warning">Sign</StatusPill> : null}
                  to={unsigned && entry.reportSubmitted ? `/visit/${entry.id}?step=Sign` : `/scheduling?appointment=${encodeURIComponent(entry.id)}&tab=Report`}
                />
              );
            })}
          </ul>
        </>
      )}

      {owed.length > 0 && (
        <>
          <p style={sectionLabel}>Reports still to file</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {owed.map((entry) => (
              <VisitRow
                key={entry.id}
                time={clock(entry.scheduledAt)}
                title={clientOf(entry)?.name || "Visit"}
                detail={`${new Date(entry.scheduledAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · no report yet`}
                badge={<StatusPill tone="danger">Report due</StatusPill>}
                to={`/visit/${entry.id}`}
              />
            ))}
          </ul>
        </>
      )}

      {!loading && today.length === 0 && owed.length === 0 && (
        <p style={{ marginTop: "20px", color: neutral.bark }}>
          Nothing waiting. Your upcoming visits are on the{" "}
          <Link to="/scheduling" style={{ color: brand.base }}>
            schedule
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export default TechnicianDashboard;
