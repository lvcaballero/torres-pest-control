// Inventory items. Same shape as ClientsContext — Supabase-backed, async
// mutators that resolve to `true` or an error string.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as inventoryService from "../services/inventoryService";
import * as appointmentService from "../services/appointmentService";
import { addLog, LOG_TYPES } from "../services/logService";
import { STOCK_OUT_REASON_LABELS } from "../utils/constants";
import { todayISO, validateMovementDate, validateQuantity } from "../utils/validators";
import { useAuthContext } from "./AuthContext";

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const { currentUser, session, sessionVerified } = useAuthContext();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState("");

  const actor = currentUser?.name;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const result = await inventoryService.fetchInventory();
    if (result.error) setError(result.error);
    else setInventory(result.inventory);

    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    if (!session || !sessionVerified) {
      setInventory([]);
      setMovements([]);
      setError("");
      setMovementsError("");
      return;
    }
    refresh();
  }, [session, sessionVerified, refresh]);

  const addItem = useCallback(
    async (form) => {
      const { item, error: createError } = await inventoryService.createItem(form, currentUser?.id, inventory);
      if (createError) return createError;

      setInventory((previous) => [item, ...previous]);
      addLog(actor, `Added "${item.name}" to inventory.`, LOG_TYPES.INVENTORY);
      return true;
    },
    [actor, currentUser?.id, inventory]
  );

  const updateItem = useCallback(
    async (itemId, form) => {
      const { item, error: updateError } = await inventoryService.updateItem(itemId, form, inventory);
      if (updateError) return updateError;

      setInventory((previous) => previous.map((entry) => (entry.id === itemId ? item : entry)));
      addLog(actor, `Updated "${item.name}".`, LOG_TYPES.INVENTORY);
      return true;
    },
    [actor, inventory]
  );

  const removeItem = useCallback(
    async (itemId) => {
      const target = inventory.find((entry) => entry.id === itemId);
      const { error: deleteError } = await inventoryService.deleteItem(itemId);
      if (deleteError) return deleteError;

      setInventory((previous) => previous.filter((entry) => entry.id !== itemId));
      addLog(actor, `Removed "${target?.name || "an item"}" from inventory.`, LOG_TYPES.INVENTORY);
      return true;
    },
    [actor, inventory]
  );

  /** Edit only ever changes Name / Type / Unit — see updateItemBasics(). */
  const updateItemBasics = useCallback(
    async (itemId, form) => {
      const { item, error: updateError } = await inventoryService.updateItemBasics(itemId, form);
      if (updateError) return updateError;

      setInventory((previous) => previous.map((entry) => (entry.id === itemId ? item : entry)));
      addLog(actor, `Edited "${item.name}".`, LOG_TYPES.INVENTORY);
      return true;
    },
    [actor]
  );

  const setItemStatus = useCallback(
    async (itemId, status) => {
      const { item, error: statusError } = await inventoryService.setItemStatus(itemId, status);
      if (statusError) return statusError;

      setInventory((previous) => previous.map((entry) => (entry.id === itemId ? item : entry)));
      const verb = status === inventoryService.INVENTORY_STATUS.DISABLED ? "Disabled" : "Enabled";
      addLog(actor, `${verb} "${item.name}".`, LOG_TYPES.INVENTORY);
      return true;
    },
    [actor]
  );

  /**
   * A whole delivery at once. One RPC, one transaction — partial success is
   * impossible, so local state is only touched after the server has committed
   * every line.
   */
  const stockInMany = useCallback(
    async (entries, { date, reference, intakeBranchOrStation, idempotencyKey }) => {
      const result = await inventoryService.stockInBatch(entries, {
        date,
        reference,
        intakeBranchOrStation,
        idempotencyKey,
      });
      if (result.error) return result.error;

      setInventory((previous) => previous.map((entry) => {
        const movement = result.movements.find((row) => row.itemId === entry.id);
        if (!movement) return entry;
        const requested = entries.find((row) => row.itemId === entry.id);
        return {
          ...entry,
          quantity: movement.newQuantity,
          cost: requested?.unitCost === "" || requested?.unitCost === undefined || requested?.unitCost === null
            ? entry.cost
            : Number(requested.unitCost),
        };
      }));

      setMovements((previous) => [
        ...result.movements.map((movement) => {
          const target = inventory.find((entry) => entry.id === movement.itemId);
          return { ...movement, itemName: target?.name || "Unknown item", itemUnit: target?.unit || "" };
        }),
        ...previous,
      ]);

      addLog(
        actor,
        `Stocked in ${result.movements.length} item${result.movements.length === 1 ? "" : "s"} against ${reference}.`,
        LOG_TYPES.INVENTORY
      );
      return true;
    },
    [actor, inventory]
  );

  /** Stock leaving for a reason other than an appointment. */
  const stockOutManual = useCallback(
    async (itemId, { amount, date, reason, technicianId, note }) => {
      const target = inventory.find((entry) => entry.id === itemId);
      if (!target) return "Inventory item not found.";
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return "Enter a quantity greater than zero.";
      if (Number(amount) > Number(target.quantity)) return "Requested quantity exceeds available stock.";
      if (reason === "TECHNICIAN_CHECKOUT" && !technicianId) return "Select the technician the stock was checked out to.";

      const result = await inventoryService.stockOutManual(itemId, { amount, date, reason, technicianId, note });
      if (result.error) return result.error;

      setInventory((previous) => previous.map((entry) =>
        entry.id === itemId ? { ...entry, quantity: result.newQuantity } : entry));
      setMovements((previous) => [
        {
          ...result.movement,
          // The server writes a fuller label ("Checked out by Ana Cruz"); this is
          // the same sentence without a second round trip to fetch the name.
          reference: STOCK_OUT_REASON_LABELS[reason] || "",
          itemName: target.name,
          itemUnit: target.unit,
        },
        ...previous,
      ]);
      addLog(actor, `Stocked out ${amount} ${target.unit} of "${target.name}".`, LOG_TYPES.INVENTORY);
      return true;
    },
    [actor, inventory]
  );

  const stockOut = useCallback(
    async (itemId, appointmentId, amount) => {
      const target = inventory.find((entry) => entry.id === itemId);
      if (!target) return "Inventory item not found.";
      if (Number(amount) > Number(target.quantity)) return "Requested quantity exceeds available stock.";
      const result = await appointmentService.stockOut(itemId, appointmentId, amount);
      if (result.error) return result.error;

      setInventory((previous) => previous.map((entry) => entry.id === itemId ? { ...entry, quantity: result.newQuantity } : entry));
      setMovements((previous) => [{
        id: result.movement.movement_id,
        itemId,
        amount: Number(result.movement.amount),
        quantityDelta: -Number(result.movement.amount),
        movementDate: result.movement.movement_date,
        reference: `Appointment ${appointmentId}`,
        actor: result.movement.actor || "",
        movementType: "OUT",
        appointmentId,
        itemName: target.name,
        itemUnit: target.unit,
      }, ...previous]);
      return { item: target, amount: Number(amount) };
    },
    [inventory]
  );

  const stockOutMany = useCallback(
    async (appointmentId, entries, date = todayISO()) => {
      const dateError = validateMovementDate(date);
      if (dateError) return dateError;
      const requested = new Map(entries.map((entry) => [entry.itemId, Number(entry.amount)]));
      for (const [itemId, amount] of requested) {
        const target = inventory.find((entry) => entry.id === itemId);
        if (!target) return "Inventory item not found.";
        // Decimals are allowed on the way out (migration 036): 0.4 L applied
        // is the honest figure. This used to demand whole numbers, which
        // contradicted both the database and the Stock-Out form.
        const quantityError = validateQuantity(amount, { label: "Stock-out quantity" });
        if (quantityError) return quantityError;
        if (amount > Number(target.quantity)) return `Requested quantity for ${target.name} exceeds available stock.`;
      }

      const result = await appointmentService.stockOutBatch(appointmentId, entries, date);
      if (result.error) return result.error;
      if (!result.movements.length) return "Stock Out did not return a saved movement.";
      setInventory((previous) => previous.map((entry) => {
        const movement = result.movements.find((row) => row.item_id === entry.id);
        return movement ? { ...entry, quantity: Number(movement.new_quantity) } : entry;
      }));
      setMovements((previous) => [
        ...result.movements.map((movement) => {
          const target = inventory.find((entry) => entry.id === movement.item_id);
          return {
            id: movement.movement_id,
            itemId: movement.item_id,
            amount: Number(movement.amount),
            quantityDelta: -Number(movement.amount),
            movementDate: movement.movement_date,
            batchNumber: movement.batch_number || "",
            reference: `Appointment ${appointmentId}`,
            actor: movement.actor || "",
            movementType: "OUT",
            stockOutReason: "APPOINTMENT",
            appointmentId,
            itemName: target?.name || "Unknown item",
            itemUnit: target?.unit || "",
          };
        }),
        ...previous,
      ]);
      return result.movements;
    },
    [inventory]
  );

  const stockCorrection = useCallback(async (itemId, delta, reason) => {
    const target = inventory.find((entry) => entry.id === itemId);
    if (!target) return "Inventory item not found.";
    if (!Number.isInteger(Number(delta)) || Number(delta) === 0) return "Correction must be a non-zero whole number.";
    if (Number(target.quantity) + Number(delta) < 0) return "Correction cannot make stock negative.";
    const result = await inventoryService.stockCorrection(itemId, delta, reason);
    if (result.error) return result.error;
    setInventory((previous) => previous.map((entry) => entry.id === itemId ? { ...entry, quantity: result.newQuantity } : entry));
    setMovements((previous) => [{
      ...result.movement,
      itemId,
      amount: Number(result.movement.amount),
      quantityDelta: Number(delta),
      movementDate: result.movement.movement_date,
      reference: result.movement.reference,
      actor: result.movement.actor || "",
      movementType: "CORRECTION",
      itemName: target.name,
      itemUnit: target.unit,
    }, ...previous]);
    return true;
  }, [inventory]);

  const refreshMovements = useCallback(async () => {
    setMovementsLoading(true);
    setMovementsError("");

    const result = await inventoryService.fetchMovements();
    if (result.error) setMovementsError(result.error);
    else setMovements(result.movements);

    setMovementsLoading(false);
    return result;
  }, []);

  useEffect(() => {
    if (session && sessionVerified) refreshMovements();
  }, [session, sessionVerified, refreshMovements]);

  const value = useMemo(
    () => ({
      inventory,
      loading,
      error,
      refresh,
      addItem,
      updateItem,
      updateItemBasics,
      removeItem,
      setItemStatus,
      stockInMany,
      stockOut,
      stockOutManual,
      stockOutMany,
      stockCorrection,
      movements,
      movementsLoading,
      movementsError,
      refreshMovements,
    }),
    [
      inventory,
      loading,
      error,
      refresh,
      addItem,
      updateItem,
      updateItemBasics,
      removeItem,
      setItemStatus,
      stockInMany,
      stockOut,
      stockOutManual,
      stockOutMany,
      stockCorrection,
      movements,
      movementsLoading,
      movementsError,
      refreshMovements,
    ]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventoryContext() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventoryContext must be used inside <InventoryProvider>.");
  return context;
}

export default InventoryContext;
