// The "+N more" tile's contents.
//
// Cards here carry the same technician colours as the grid, so the colour
// language survives the jump from the calendar into the dialog.

import { neutral, text } from "../../styles/tokens";
import Modal from "../ui/Modal";
import AppointmentCard from "./AppointmentCard";

const clockLabel = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function OverflowDialog({ group, onClose }) {
  if (!group) return null;

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Scheduling"
      title={new Date(group.start).toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      })}
      size="sm"
    >
      <p style={{ ...text.small, color: neutral.bark, margin: "0 0 12px" }}>
        {group.items.length} more between {clockLabel(group.start)} and {clockLabel(group.end)}
      </p>

      <div style={{ display: "grid", gap: "6px" }}>
        {group.items.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        ))}
      </div>
    </Modal>
  );
}

export default OverflowDialog;
