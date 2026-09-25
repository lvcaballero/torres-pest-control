// The week calendar.
//
// One positioned layer per day, so a card spans its real duration instead of
// being trapped inside its starting hour. Hour lines are painted as a
// repeating gradient rather than as real rows, which keeps the day column a
// single positioning context for the absolutely-placed cards.
//
// The grid renders only the hours the week actually uses (see
// visibleHourWindow). Before that, a week with four appointments drew all
// thirteen business hours at a fixed 56px, so the page was 728px of mostly
// empty ruled paper — which is the single loudest thing wrong with the old
// screen.
//
// Every position here derives from `gridStartHour` and `rowHeight`, which the
// page passes down. Those two values, and nothing else, are what changed to
// make the narrowing possible.

import { brand, font, neutral, radius, surface, weight } from "../../styles/tokens";
import {
  clampToBookableDay,
  columnPlacement,
  hoursIn,
  minutesFromGridStart,
  minutesToPixel,
  pixelToMinutes,
  spanGeometry,
} from "../../utils/calendarGeometry";
import { formatHour, localDateKey, minutesToTimeValue } from "../../utils/calendarDates";
import AppointmentCard from "./AppointmentCard";
import { useCalendar } from "./CalendarContext";

/** Snap a pointer position inside a day column to a bookable clock time. */
function timeAtPointer(event, { gridStartHour, rowHeight, dayStartHour, dayEndHour }) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const raw = pixelToMinutes(event.clientY - bounds.top, { gridStartHour, rowHeight, snapTo: 10 });
  // The visible window may start before the working day so an early visit
  // stays reachable, but a NEW visit there would be refused by the server.
  return minutesToTimeValue(clampToBookableDay(raw, { dayStartHour, dayEndHour }));
}

function WeekGrid({
  weekDays,
  weekLayout,
  window: hourWindow,
  rowHeight,
  dayStartHour,
  dayEndHour,
  onEmptyClick,
  onDropAt,
  onShowOverflow,
  onShowAllHours,
  loadFor = null,
  now = new Date(),
}) {
  const { draggedId } = useCalendar();
  const hours = hoursIn(hourWindow);
  const gridStartHour = hourWindow.startHour;
  const todayKey = localDateKey(now);
  const gridHeight = hours.length * rowHeight;
  // One column per day given: seven for the week view, one for the day view.
  const dayCount = weekDays.length;
  const nowTop = minutesToPixel(minutesFromGridStart(now, gridStartHour), rowHeight);
  const showNow = nowTop >= 0 && nowTop <= gridHeight;

  const geometryFor = (start, end) =>
    spanGeometry(start, end, { gridStartHour, rowHeight, minHeight: 30, gap: 2 });

  const pointerOptions = { gridStartHour, rowHeight, dayStartHour, dayEndHour };

  return (
    <div
      style={{
        overflowX: "auto",
        overflowY: "auto",
        // Sized to the content rather than to a fixed viewport fraction, so a
        // narrow window does not leave a tall empty scroll box below the grid.
        maxHeight: `min(72vh, ${gridHeight + 56}px)`,
        border: `1px solid ${surface.sunken}`,
        borderRadius: radius.card,
        background: surface.panel,
      }}
    >
      <div
        data-columns={dayCount}
        style={{
          minWidth: dayCount === 1 ? 0 : "780px",
          display: "grid",
          gridTemplateColumns: `64px repeat(${dayCount}, minmax(95px, 1fr))`,
        }}
      >
        {/* Header row stays put while the hours scroll under it. */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 3,
            background: surface.canvas,
            borderBottom: `1px solid ${surface.sunken}`,
            borderRight: `1px solid ${surface.sunken}`,
          }}
        />

        {weekDays.map((date) => {
          const key = localDateKey(date);
          const outside = weekLayout.get(key)?.outside || [];
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 3,
                padding: "10px 10px 8px",
                textAlign: "left",
                borderRight: `1px solid ${surface.sunken}`,
                borderBottom: `1px solid ${surface.sunken}`,
                background: isToday ? "#f7eeea" : surface.panel,
              }}
            >
              <div
                style={{
                  fontSize: "11.5px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: isToday ? brand.base : neutral.bark,
                }}
              >
                {date.toLocaleDateString([], { weekday: "short" })}
                {isToday ? " · Today" : ""}
              </div>
              <div
                style={{
                  color: isToday ? brand.base : neutral.ink,
                  font: `500 22px/1.1 ${font.display}`,
                  marginTop: "2px",
                }}
              >
                {date.getDate()}
              </div>
              {loadFor && (
                <div
                  role="img"
                  aria-label={`${Math.round(loadFor(key) * 100)}% booked`}
                  title={`${Math.round(loadFor(key) * 100)}% of the team's day is booked`}
                  style={{ height: "3px", background: surface.sunken, borderRadius: "2px", marginTop: "8px", overflow: "hidden" }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${Math.round(loadFor(key) * 100)}%`,
                      background: isToday ? brand.base : neutral.saddle,
                    }}
                  />
                </div>
              )}

              {/* The window never hides an appointment, so this is normally
                  empty — it stays as a safety net, and as the way back to the
                  full day if one ever does fall outside. */}
              {outside.length > 0 && (
                <button
                  type="button"
                  onClick={onShowAllHours}
                  className="ui-interactive"
                  style={{
                    marginTop: "3px",
                    border: "none",
                    background: "rgba(160, 106, 36, 0.14)",
                    color: "#a06a24",
                    borderRadius: radius.pill,
                    padding: "1px 7px",
                    fontSize: "10px",
                    fontWeight: weight.medium,
                    cursor: "pointer",
                  }}
                >
                  {outside.length} outside · show all
                </button>
              )}
            </div>
          );
        })}

        {/* Hour labels down the gutter. */}
        <div style={{ borderRight: `1px solid ${surface.sunken}` }}>
          {hours.map((hour) => (
            <div
              key={hour}
              style={{
                height: `${rowHeight}px`,
                boxSizing: "border-box",
                borderBottom: `1px solid ${surface.sunken}`,
                color: neutral.bark,
                fontSize: "11px",
                padding: "3px 6px",
                textAlign: "right",
              }}
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* One positioned layer per day. */}
        {weekDays.map((date) => {
          const key = localDateKey(date);
          const layout = weekLayout.get(key) || { placed: [], overflow: [] };
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              // Identifies the drop target for tests and for anything that
              // needs to find a specific day's column in the DOM.
              data-day={key}
              onClick={(event) => {
                // A click that landed on a card is that card's, not the grid's.
                if (event.target.closest("button")) return;
                onEmptyClick(key, timeAtPointer(event, pointerOptions));
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDropAt(key, timeAtPointer(event, pointerOptions))}
              style={{
                position: "relative",
                height: `${gridHeight}px`,
                borderRight: `1px solid ${surface.sunken}`,
                background: draggedId || isToday ? "rgba(127, 17, 17, 0.025)" : surface.panel,
                backgroundImage: `repeating-linear-gradient(to bottom, ${surface.sunken} 0px, ${surface.sunken} 1px, transparent 1px, transparent ${rowHeight}px)`,
              }}
            >
              {isToday && showNow && (
                <span
                  aria-hidden="true"
                  data-now-line=""
                  style={{ position: "absolute", left: "-1px", right: 0, top: `${nowTop}px`, borderTop: `1.5px solid ${brand.base}`, zIndex: 4, pointerEvents: "none" }}
                >
                  <span style={{ position: "absolute", left: "-4px", top: "-4.5px", width: "7px", height: "7px", borderRadius: "50%", background: brand.base }} />
                </span>
              )}
              {layout.placed.map(({ appointment, column, columns }) => {
                const { top, height } = geometryFor(
                  new Date(appointment.scheduledAt).getTime(),
                  new Date(appointment.scheduledAt).getTime() + (appointment.durationMinutes || 60) * 60000
                );

                return (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    height={height}
                    columns={columns}
                    placement={{
                      position: "absolute",
                      top: `${top + 1}px`,
                      height: `${height}px`,
                      ...columnPlacement(column, columns),
                    }}
                  />
                );
              })}

              {layout.overflow.map((group) => {
                const { top, height } = geometryFor(group.start, group.end);

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onShowOverflow({ ...group, dateKey: key })}
                    className="ui-interactive"
                    style={{
                      position: "absolute",
                      top: `${top + 1}px`,
                      height: `${height}px`,
                      ...columnPlacement(group.column, group.columns),
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "1px",
                      border: `1px dashed ${neutral.loam}`,
                      borderRadius: radius.control,
                      background: surface.sunken,
                      color: neutral.saddle,
                      fontWeight: weight.medium,
                      fontSize: "11px",
                      cursor: "pointer",
                      overflow: "hidden",
                      zIndex: 1,
                    }}
                  >
                    +{group.items.length} more
                    {height >= 44 && (
                      <span style={{ color: neutral.bark, fontSize: "10px" }}>tap to view</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeekGrid;
