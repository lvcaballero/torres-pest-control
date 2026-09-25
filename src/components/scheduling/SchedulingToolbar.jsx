// The one control row above the calendar: view, period, technicians.
//
// Views are Day / Week / Month / List. The old Technicians view is gone —
// the Day view shows each visit's crew as initials and the side panel's
// Technician load gives the hours, which is what that grid was used for.
//
// Technicians are filter chips with their initials, as on the cards, so the
// filter doubles as the key to who "JD" is. Below 860px the chips collapse
// into the TechnicianFilter dropdown so the row never runs off the screen.
//
// There is no create button here: the top bar's "New visit" is the page's one
// primary action.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { brand, font, neutral, radius, surface, weight } from "../../styles/tokens";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import SegmentedControl from "../ui/SegmentedControl";
import Toolbar from "../ui/Toolbar";
import TechnicianFilter, { ALL_TECHNICIANS, UNASSIGNED_ONLY } from "./TechnicianFilter";

/** The four things the page can show. */
export const MODES = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  LIST: "list",
};

export const isCalendarMode = (mode) => mode === MODES.DAY || mode === MODES.WEEK || mode === MODES.MONTH;

const MODE_OPTIONS = [
  { value: MODES.DAY, label: "Day" },
  { value: MODES.WEEK, label: "Week" },
  { value: MODES.MONTH, label: "Month" },
  { value: MODES.LIST, label: "List" },
];

function Chip({ selected, onClick, children, label }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className="ui-interactive"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        border: `1px solid ${selected ? brand.base : neutral.loam}`,
        background: selected ? "rgba(127, 17, 17, 0.07)" : surface.panel,
        color: selected ? brand.base : neutral.ink,
        borderRadius: radius.pill,
        padding: "3px 10px 3px 4px",
        fontSize: "12.5px",
        fontWeight: selected ? weight.medium : weight.regular,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/** One chip per technician plus Unassigned. Clicking the selected chip clears the filter. */
export function TechnicianChips({ technicians, value, onChange, countFor = () => null }) {
  const toggle = (key) => onChange(value === key ? ALL_TECHNICIANS : key);
  const countLabel = (count) => (count == null ? "" : `, ${count} ${count === 1 ? "visit" : "visits"}`);

  return (
    <div role="group" aria-label="Filter by technician" className="tech-chips" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {technicians.map((account) => {
        const name = account.name || account.username;
        return (
          <Chip
            key={account.id}
            selected={value === account.id}
            onClick={() => toggle(account.id)}
            label={`${name}${countLabel(countFor(account.id))}`}
          >
            <Avatar user={account} size="sm" />
            {name.split(" ")[0]}
          </Chip>
        );
      })}
      <Chip
        selected={value === UNASSIGNED_ONLY}
        onClick={() => toggle(UNASSIGNED_ONLY)}
        label={`Unassigned${countLabel(countFor(null))}`}
      >
        <Avatar user={null} size="sm" />
        Unassigned
      </Chip>
    </div>
  );
}

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
}) {
  // List mode has its own date filters, so period navigation would be a
  // second, contradictory way to choose a range.
  const showPeriodNav = mode !== MODES.LIST;
  const unit = mode === MODES.DAY ? "day" : mode === MODES.MONTH ? "month" : "week";

  return (
    <Toolbar
      start={
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <SegmentedControl ariaLabel="Scheduling view" options={MODE_OPTIONS} value={mode} onChange={onModeChange} size="sm" />
          {showPeriodNav && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Button size="icon" variant="quiet" aria-label="Previous period" title={`Previous ${unit}`} onClick={() => onNavigate(-1)}>
                <ChevronLeft size={15} strokeWidth={1.75} />
              </Button>
              <Button size="md" variant="quiet" onClick={onToday} disabled={isOnToday}>
                Today
              </Button>
              <Button size="icon" variant="quiet" aria-label="Next period" title={`Next ${unit}`} onClick={() => onNavigate(1)}>
                <ChevronRight size={15} strokeWidth={1.75} />
              </Button>
              <strong
                style={{
                  color: neutral.ink,
                  font: `500 18px/1.2 ${font.display}`,
                  marginLeft: "8px",
                  whiteSpace: "nowrap",
                }}
              >
                {rangeLabel}
              </strong>
            </div>
          )}
        </div>
      }
      end={
        !isTechnician && (
          <>
            <TechnicianChips technicians={technicians} value={technicianFilter} onChange={onTechnicianFilterChange} countFor={countFor} />
            <div className="tech-dropdown">
              <TechnicianFilter technicians={technicians} value={technicianFilter} onChange={onTechnicianFilterChange} countFor={countFor} />
            </div>
          </>
        )
      }
    />
  );
}

export default SchedulingToolbar;
