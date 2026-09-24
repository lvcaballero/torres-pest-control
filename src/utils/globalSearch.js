// The top bar's search: one query across the records already loaded into
// context. Nothing here calls the backend — the contexts hold the whole
// client, appointment, inventory and account lists already, and searching
// them locally makes the box answer as you type.
//
// Pure, so the matching and ranking are unit-tested without rendering.

import { crewOf } from "./scheduling";

const PER_GROUP = 5;

function normalise(value) {
  return String(value ?? "").toLowerCase();
}

/**
 * How well `fields` match `query`: 3 for a field that starts with it (a
 * reference number typed in full, a name typed from the front), 1 for one
 * that merely contains it, 0 for no match. Every query word must match
 * somewhere, so "cruz bakery" does not match every Cruz.
 */
export function scoreMatch(query, fields) {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const haystacks = fields.map(normalise).filter(Boolean);
  let score = 0;
  for (const word of words) {
    let best = 0;
    for (const hay of haystacks) {
      if (hay.startsWith(word) || hay.includes(` ${word}`)) best = Math.max(best, 3);
      else if (hay.includes(word)) best = Math.max(best, 1);
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

function top(entries) {
  return entries
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, PER_GROUP);
}

/**
 * @returns groups in display order, each `{ key, label, results }`, where a
 * result is `{ id, label, detail, to, score }`. Empty groups are dropped.
 * Pass `null` for a list the user may not see; it is skipped entirely.
 */
export function searchEverything(query, { clients = null, appointments = null, inventory = null, users = null, now = new Date() } = {}) {
  if (!normalise(query).trim()) return [];

  const clientById = new Map((clients || []).map((client) => [client.id, client]));
  const userById = new Map((users || []).map((user) => [user.id, user]));
  const groups = [];

  if (clients) {
    groups.push({
      key: "clients",
      label: "Clients",
      results: top(
        clients.map((client) => ({
          id: client.id,
          label: client.name,
          detail: [client.reference, client.address].filter(Boolean).join(" · "),
          to: `/clients/${client.id}`,
          score: scoreMatch(query, [client.name, client.reference, client.phone, client.email, client.address]),
        }))
      ),
    });
  }

  if (appointments) {
    // Upcoming visits first: someone searching a client's name usually wants
    // the next visit, not one from March.
    const nowMs = now.getTime();
    groups.push({
      key: "visits",
      label: "Visits",
      results: top(
        appointments.map((appointment) => {
          const client = clientById.get(appointment.clientId);
          const when = new Date(appointment.scheduledAt);
          const crew = crewOf(appointment)
            .map((id) => userById.get(id)?.name)
            .filter(Boolean);
          const base = scoreMatch(query, [
            client?.name,
            client?.reference,
            appointment.serviceType,
            appointment.pestConcern,
            appointment.serviceLocation,
            ...crew,
          ]);
          return {
            id: appointment.id,
            label: client?.name || "Visit",
            detail: [
              when.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
              when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
              appointment.serviceType || appointment.pestConcern,
              appointment.status,
            ]
              .filter(Boolean)
              .join(" · "),
            to: `/scheduling?appointment=${appointment.id}`,
            score: base && base + (when.getTime() >= nowMs ? 0.5 : 0),
          };
        })
      ),
    });
  }

  if (inventory) {
    groups.push({
      key: "items",
      label: "Items",
      results: top(
        inventory.map((item) => ({
          id: item.id,
          label: item.name,
          detail: [item.type, `${item.quantity ?? 0} ${item.unit || ""}`.trim(), item.storageLocation].filter(Boolean).join(" · "),
          to: `/inventory?q=${encodeURIComponent(item.name)}`,
          score: scoreMatch(query, [item.name, item.supplier, item.serialNumber, item.storageLocation]),
        }))
      ),
    });
  }

  if (users) {
    groups.push({
      key: "accounts",
      label: "Accounts",
      results: top(
        users.map((user) => ({
          id: user.id,
          label: user.name || user.username,
          detail: [user.reference, user.role, user.status === "INACTIVE" ? "Inactive" : null].filter(Boolean).join(" · "),
          to: "/users",
          score: scoreMatch(query, [user.name, user.username, user.reference, user.email]),
        }))
      ),
    });
  }

  return groups.filter((group) => group.results.length > 0);
}
