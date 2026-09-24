// The one control row above the calendar.
//
// This replaces three stacked rows: the Calendar/List/Technicians tabs and
// the technician <select> on one, the Week/Month toggle beside them, and the
// date navigation on a third — with a colour legend underneath that was a
// fourth control for state the <select> already owned.
//
// Two merges do most of the work. `view` and `scheduleTab` became a single
// `mode`, which turns two segmented controls into one; and the legend folded
// into the technician filter, which is where the colours were needed anyway.

import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Users } from "lucide-react";
import { neutral, text, weight } from "../../styles/tokens";
import Button from "../ui/Button";
import SegmentedControl from "../ui/SegmentedControl";
import Toolbar from "../ui/Toolbar";
import TechnicianFilter from "./TechnicianFilter";

/** The four things the page can show. `view` and `scheduleTab` used to split these. */
export const MODES = {
  WEEK: "week",
  MONTH: "month",
  LIST: "list",
  TECHNICIANS: "technicians",
};

export const isCalendarMode = (mode) => mode === MODES.WEEK || mode === MODES.MONTH;

const MODE_OPTIONS = [
  { value: MODES.WEEK, label: "Week", icon: <CalendarDays size={13} aria-hidden="true" /> },
  { value: MODES.MONTH, label: "Month" },
  { value: MODES.LIST, label: "List", icon: <List size={13} aria-hidden="true" /> },
  { value: MODES.TECHNICIANS, label: "Technicians", icon: <Users size={13} aria-hidden="true" /> },
];

function SchedulingToolbar({
  mode,
  onModeChange,
  rangeLabel,
  onNavigate,
  onToday,
  isOnToday,
  technicians,
  technicianFilter,
  onTechnicianFilterChange,
  countFor,
  isTechnician,
  canCreate,
  onCreate,
}) {
  const modeOptions = isTechnician
    ? MODE_OPTIONS.filter((option) => option.value !== MODES.TECHNICIANS)
    : MODE_OPTIONS;

  // List mode has its own date-from/date-to filters, so the period navigation
  // would be a second, contradictory way to choose a range.
  const showPeriodNav = mode !== MODES.LIST;

  return (
    <Toolbar
      start={
        <SegmentedControl
          ariaLabel="Scheduling view"
          options={modeOptions}
          value={mode}
          onChange={onModeChange}
          size="sm"
        />
      }
      center={
        showPeriodNav ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Button size="icon" aria-label="Previous period" onClick={() => onNavigate(-1)}>
              <ChevronLeft size={15} strokeWidth={1.75} />
            </Button>
            {/* Between the chevrons, because it is the reset — not a third
                direction to travel in. */}
            <Button size="sm" onClick={onToday} disabled={isOnToday}>
              Today
            </Button>
            <Button size="icon" aria-label="Next period" onClick={() => onNavigate(1)}>
              <ChevronRight size={15} strokeWidth={1.75} />
            </Button>
            <strong
              style={{
                color: neutral.ink,
                fontSize: text.small.fontSize,
                fontWeight: weight.medium,
                marginLeft: "6px",
                whiteSpace: "nowrap",
              }}
            >
              {rangeLabel}
            </strong>
          </div>
        ) : null
      }
      end={
        <>
          {!isTechnician && (
            <TechnicianFilter
              technicians={technicians}
              value={technicianFilter}
              onChange={onTechnicianFilterChange}
              countFor={countFor}
            />
          )}
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={onCreate}
              icon={<Plus size={14} strokeWidth={2} />}
            >
              New appointment
            </Button>
          )}
        </>
      }
    />
  );
}

export default SchedulingToolbar;
