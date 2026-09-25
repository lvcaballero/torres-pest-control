// What to watch on each inventory item, for the Inventory "Watch" column,
// its alert cards and its urgency sort. Pure, so the rules are tested.
//
// One item can have several concerns (a chemical that is both low and about
// to expire); `watchFor` reports the most urgent, `concernsOf` all of them.

import { localDate } from "./dispatch";

const DAY = 86400000;
export const EXPIRY_WINDOW_DAYS = 30;
export const SERVICE_SOON_DAYS = 14;

const today = (now) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
};
const daysUntil = (date, now) => Math.round((date - today(now)) / DAY);
const monthYear = (date) => date.toLocaleDateString([], { month: "short", year: "numeric" });
const dayMonth = (date) => date.toLocaleDateString([], { month: "short", day: "numeric" });

export const isActive = (item) => item.status !== "DISABLED";

export function isBelowReorder(item) {
  if (!isActive(item)) return false;
  if (Number(item.quantity) <= 0) return true;
  return item.reorderLevel !== null && item.reorderLevel !== undefined && item.reorderLevel !== "" && Number(item.quantity) <= Number(item.reorderLevel);
}

export function isExpiringSoon(item, now = new Date()) {
  const expires = item.type === "CHEMICAL" ? localDate(item.expirationDate) : null;
  return Boolean(isActive(item) && expires && Number(item.quantity) > 0 && daysUntil(expires, now) <= EXPIRY_WINDOW_DAYS);
}

export function isMaintenanceOverdue(item, now = new Date()) {
  const due = item.type === "EQUIPMENT" ? localDate(item.nextMaintenanceDate) : null;
  return Boolean(isActive(item) && due && daysUntil(due, now) < 0);
}

/**
 * Every concern on an item, most urgent first. Each: { key, tone, label, rank }
 * where a lower rank is more urgent. Tones are StatusPill tones.
 */
export function concernsOf(item, now = new Date()) {
  const concerns = [];
  if (!isActive(item)) return concerns;
  const expires = item.type === "CHEMICAL" ? localDate(item.expirationDate) : null;
  const serviceDue = item.type === "EQUIPMENT" ? localDate(item.nextMaintenanceDate) : null;

  if (expires && Number(item.quantity) > 0) {
    const days = daysUntil(expires, now);
    if (days < 0) concerns.push({ key: "expired", tone: "danger", label: `Expired ${dayMonth(expires)}`, rank: 0 });
    else if (days <= EXPIRY_WINDOW_DAYS) concerns.push({ key: "expiring", tone: "danger", label: `Expires ${dayMonth(expires)}`, rank: 1 });
  }
  if (Number(item.quantity) <= 0) concerns.push({ key: "out", tone: "danger", label: "Out of stock", rank: 1 });
  else if (isBelowReorder(item)) concerns.push({ key: "low", tone: "danger", label: "Low stock", rank: 2 });
  if (serviceDue) {
    const days = daysUntil(serviceDue, now);
    if (days < 0) concerns.push({ key: "service-overdue", tone: "warning", label: `Service overdue · ${dayMonth(serviceDue)}`, rank: 3 });
    else if (days <= SERVICE_SOON_DAYS) concerns.push({ key: "service-soon", tone: "warning", label: `Service due ${dayMonth(serviceDue)}`, rank: 4 });
  }
  return concerns.sort((a, b) => a.rank - b.rank);
}

/**
 * What the Watch column shows: the most urgent concern as a pill, or a quiet
 * note of the next date to know ("Exp. Aug 2027", "Service Mar 2027").
 */
export function watchFor(item, now = new Date()) {
  const [top] = concernsOf(item, now);
  if (top) return { ...top, pill: true };
  const expires = item.type === "CHEMICAL" ? localDate(item.expirationDate) : null;
  if (expires) return { key: "expiry-note", label: `Exp. ${monthYear(expires)}`, pill: false, rank: 9 };
  const serviceDue = item.type === "EQUIPMENT" ? localDate(item.nextMaintenanceDate) : null;
  if (serviceDue) return { key: "service-note", label: `Service ${monthYear(serviceDue)}`, pill: false, rank: 9 };
  return { key: "none", label: "", pill: false, rank: 10 };
}

/** Most urgent first; disabled items last; then by name. */
export function sortByUrgency(items, now = new Date(), lossesByItem = new Map()) {
  const rankOf = (item) => {
    if (!isActive(item)) return 20;
    const base = watchFor(item, now).rank;
    return lossesByItem.has(item.id) ? Math.min(base, 5) : base;
  };
  return [...items].sort((a, b) => rankOf(a) - rankOf(b) || String(a.name).localeCompare(String(b.name)));
}

/** Counts for the four alert cards. */
export function inventoryAlerts(items, now = new Date(), lossesByItem = new Map()) {
  return {
    low: items.filter(isBelowReorder).length,
    expiring: items.filter((item) => isExpiringSoon(item, now)).length,
    maintenance: items.filter((item) => isMaintenanceOverdue(item, now)).length,
    losses: items.filter((item) => lossesByItem.has(item.id)).length,
  };
}

/** Value on hand at current unit cost. */
export const itemValue = (item) => (Number(item.quantity) || 0) * (Number(item.cost) || 0);
