// The month calendar.
//
// This was previously a single ~1400-character line, which is why nobody had
// noticed that dropping an appointment into a month cell silently rebooked it
// to 09:00: the drop handler called moveAppointment with no time and let the
// default parameter decide. Here the cell passes the appointment's own
// time-of-day, so a month drag changes the date and nothing else.

import { neutral, radius, surface, text, weight } from "../../styles/tokens";
import { localDateKey } from "../../utils/calendarDates";
import AppointmentCard from "./AppointmentCard";

function MonthGrid({ monthCells, anchorDate, appointmentsFor, onDropAt }) {
  const todayKey = localDateKey(new Date());

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(90px, 1fr))",
        overflowX: "auto",
        minWidth: "680px",
        border: `1px solid ${surface.sunken}`,
        borderRadius: radius.card,
        overflow: "hidden",
        background: surface.panel,
      }}
    >
      {monthCells.map((date) => {
        const key = localDateKey(date);
        const entries = appointmentsFor(key);
        const inMonth = date.getMonth() === anchorDate.getMonth();
        const isToday = key === todayKey;

        return (
          <div
            key={key}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDropAt(key)}
            style={{
              minHeight: "112px",
              padding: "6px",
              borderRight: `1px solid ${surface.sunken}`,
              borderBottom: `1px solid ${surface.sunken}`,
              // Days outside the shown month recede one surface step.
              background: inMonth ? surface.panel : surface.canvas,
            }}
          >
            <div
              style={{
                ...text.caption,
                color: isToday ? "#7f1111" : inMonth ? neutral.ink : neutral.loam,
                fontWeight: isToday ? weight.medium : weight.regular,
                marginBottom: "4px",
              }}
            >
              {date.getDate()}
            </div>

            <div style={{ display: "grid", gap: "3px" }}>
              {entries.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} dense />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MonthGrid;
