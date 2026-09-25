// Which deliveries of an item are still on the shelf, and when they expire.
//
// Migration 048 records the expiration date (and lot) on each Stock In line
// instead of once on the item. The stock level is still one number,
// inventory.quantity, so which containers make it up is derived: assuming
// first-in-first-out, what is left is the most recent deliveries. Walk the IN
// movements newest-first, taking from each until the current quantity is
// accounted for. Stock that no delivery explains (a positive correction, or
// quantity from before movements existed) is left as "unaccounted".
//
// Pure, so it can be tested without the page.

import { todayISO } from "./validators";

/** Days before expiry at which an item starts to show a warning. */
export const EXPIRY_WARNING_DAYS = 30;

const dayKey = (value) => (value ? String(value).slice(0, 10) : "");

/** Whole days from `today` to `date` (both YYYY-MM-DD). Negative once passed. */
export function daysUntil(date, today = todayISO()) {
  const to = Date.parse(`${dayKey(date)}T00:00:00Z`);
  const from = Date.parse(`${dayKey(today)}T00:00:00Z`);
  if (Number.isNaN(to) || Number.isNaN(from)) return null;
  return Math.round((to - from) / 86400000);
}

/** "EXPIRED" | "SOON" | "OK" | "" for a date, relative to today. */
export function expiryStatus(date, { today = todayISO(), warningDays = EXPIRY_WARNING_DAYS } = {}) {
  const days = daysUntil(date, today);
  if (days === null) return "";
  if (days < 0) return "EXPIRED";
  if (days <= warningDays) return "SOON";
  return "OK";
}

/**
 * The deliveries still on hand for one item, newest first:
 * { lots: [{ movementId, receivedOn, batchNumber, expirationDate, quantity }], unaccounted }.
 * `quantity` on a lot is the part of that delivery still estimated on the shelf.
 */
export function lotsOnHand(item, movements) {
  let remaining = Math.max(0, Number(item?.quantity) || 0);
  const deliveries = movements
    .filter((movement) => movement.itemId === item?.id && movement.movementType === "IN")
    .sort((a, b) =>
      dayKey(b.movementDate).localeCompare(dayKey(a.movementDate)) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const lots = [];
  for (const delivery of deliveries) {
    if (remaining <= 0) break;
    const received = Math.abs(Number(delivery.quantityDelta ?? delivery.amount) || 0);
    const quantity = Math.min(received, remaining);
    if (quantity <= 0) continue;
    remaining -= quantity;
    lots.push({
      movementId: delivery.id,
      receivedOn: dayKey(delivery.movementDate),
      batchNumber: delivery.batchNumber || "",
      expirationDate: dayKey(delivery.expirationDate),
      quantity: Math.round(quantity * 10000) / 10000,
    });
  }
  return { lots, unaccounted: Math.round(remaining * 10000) / 10000 };
}

/**
 * The soonest expiry among the lots on hand, or null. Items with no dated
 * delivery at all fall back on the pre-048 item-level date, flagged `legacy`.
 */
export function nearestExpiryOnHand(item, movements) {
  if (!item || Number(item.quantity) <= 0) return null;
  const { lots } = lotsOnHand(item, movements);
  const dated = lots.filter((lot) => lot.expirationDate);
  if (dated.length) {
    const soonest = dated.reduce((best, lot) => (lot.expirationDate < best.expirationDate ? lot : best));
    return { date: soonest.expirationDate, batchNumber: soonest.batchNumber, legacy: false };
  }
  const anyDatedDelivery = movements.some(
    (movement) => movement.itemId === item.id && movement.movementType === "IN" && movement.expirationDate
  );
  if (!anyDatedDelivery && item.expirationDate) {
    return { date: dayKey(item.expirationDate), batchNumber: "", legacy: true };
  }
  return null;
}

/** Map<itemId, { date, batchNumber, legacy, status }> for items expired or expiring soon. */
export function expiringItems(inventory, movements, { today = todayISO(), warningDays = EXPIRY_WARNING_DAYS } = {}) {
  const byItem = new Map();
  inventory.forEach((item) => {
    if (item.type !== "CHEMICAL") return;
    const nearest = nearestExpiryOnHand(item, movements);
    if (!nearest) return;
    const status = expiryStatus(nearest.date, { today, warningDays });
    if (status === "EXPIRED" || status === "SOON") byItem.set(item.id, { ...nearest, status });
  });
  return byItem;
}

/** "Expired 3 days ago" / "Expires today" / "Expires in 12 days". */
export function describeExpiry(date, today = todayISO()) {
  const days = daysUntil(date, today);
  if (days === null) return "";
  if (days < 0) return `Expired ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}
