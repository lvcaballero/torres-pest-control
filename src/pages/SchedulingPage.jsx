import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  FileText,
  GripVertical,
  Lock,
  MapPin,
  PackageCheck,
  Plus,
  Printer,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import ClientDocuments from "../components/clients/ClientDocuments";
import SignaturePreview from "../components/common/SignaturePreview";
import SignaturePad from "../components/scheduling/SignaturePad";
import ServiceReportPrinter from "../components/scheduling/ServiceReportPrinter";
import useAuth from "../hooks/useAuth";
import useClients from "../hooks/useClients";
import useInventory from "../hooks/useInventory";
import useUsers from "../hooks/useUsers";
import useServices from "../hooks/useServices";
import { useScheduling } from "../context/SchedulingContext";
import { useToast } from "../context/ToastContext";
import { APPOINTMENT_STATUSES, ATTACHMENT_CATEGORIES, DOCUMENT_CATEGORIES, PEST_CONCERN_SUGGESTIONS, ROLES, LIMITS, SERVICE_FREQUENCIES } from "../utils/constants";
import useTreatmentMethods from "../hooks/useTreatmentMethods";
import useNow from "../hooks/useNow";
import { CALENDAR_END_HOUR, DAY_END_HOUR, DAY_START_HOUR, SCHEDULE_END_HOUR, allowedNextStatuses, bookableTechnicians, busyTechnicianIds, canTransition, crewOf, dayLoad, describeSlotConflict, findTechnicianConflicts, isAssignedTo, layoutDayAppointments, moveSteps, technicianHours } from "../utils/scheduling";
import {
  addDays,
  formatDateTime,
  localDateKey,
  minutesOfDay,
  minutesToTimeValue,
  readDuration,
  startOfWeek,
  toDateTimeLocal,
} from "../utils/calendarDates";
import { badgeStyle } from "../components/scheduling/appointmentTheme";
import CalendarLegend from "../components/scheduling/CalendarLegend";
import ScheduleSidePanel from "../components/scheduling/ScheduleSidePanel";
import { awaitingReschedule } from "../utils/dashboardMetrics";
import { reserviceDue } from "../utils/dispatch";
import { CalendarProvider } from "../components/scheduling/CalendarContext";
import WeekGrid from "../components/scheduling/WeekGrid";
import MonthGrid from "../components/scheduling/MonthGrid";
import OverflowDialog from "../components/scheduling/OverflowDialog";
import NewAppointmentModal from "../components/scheduling/NewAppointmentModal";
import TechnicianPicker from "../components/scheduling/TechnicianPicker";
import SchedulingToolbar, { MODES, isCalendarMode } from "../components/scheduling/SchedulingToolbar";
import {
  fullDayWindow,
  hoursIn,
  rowHeightForWindow,
  visibleHourWindow,
} from "../utils/calendarGeometry";
import PageHeader from "../components/common/PageHeader";
import { todayISO, validateAppointmentStart, validateAttachment, validateDuration, validateMoney, validateMovementDate, validateQuantity } from "../utils/validators";
import { card, colors, inputStyle, pageShell, primaryButton, secondaryButton, sunkenPanel } from "../styles/theme";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

// Past three side-by-side cards none of them is readable, so the rest go
// behind a "+N more" tile. Grid geometry now lives in utils/calendarGeometry
// and is computed per render from the hours the week actually uses.
const MAX_CARD_COLUMNS = 3;

const TAB_LABELS = ["Overview", "Documents", "Report", "Stock-Out"];
const STOCK_CATEGORIES = ["CHEMICAL", "MATERIAL", "EQUIPMENT"];
// Select value for a service name that has no profile behind it any more.
const LEGACY_SERVICE = "__legacy__";

function SchedulingPage() {
  const { can, currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const { clients, addDocument, removeDocument, getDocumentUrl } = useClients();
  const { inventory, stockOutMany } = useInventory();
  const { staff, technicians } = useUsers();
  const { activeServices, serviceById, serviceByName } = useServices();
  const { appointments, createAppointment, updateAppointment, submitReport, addStockUsed, addAttachment, removeAttachment, getAttachmentUrl, uploadSignature, getSignatureUrl, loading, error } = useScheduling();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState(MODES.WEEK);
  const now = useNow(60000);
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [tab, setTab] = useState("Overview");
  const [draggedId, setDraggedId] = useState(null);
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createClientId, setCreateClientId] = useState("");
  const [createScheduledAt, setCreateScheduledAt] = useState("");
  // Service, frequency and pest concern carried over when booking a re-service.
  const [createPrefill, setCreatePrefill] = useState(null);
  // A re-service card being dragged from the side panel (not an appointment).
  const [reserviceDrag, setReserviceDrag] = useState(null);
  const [overflowGroup, setOverflowGroup] = useState(null);
  const [printRequest, setPrintRequest] = useState(null);
  const { methods: dynamicMethods, groups: dynamicGroups } = useTreatmentMethods();
  const [treatmentMethods, setTreatmentMethods] = useState([]);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  // Widens the grid back to the whole working day when something falls
  // outside the window the week would otherwise show.
  const [showAllHours, setShowAllHours] = useState(false);
  const [technicianFilter, setTechnicianFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [pestConcernFilter, setPestConcernFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const draggedCardRef = useRef(false);

  // Two separate rights, and they do not line up:
  //   reschedule - moving a visit is an office decision, so technicians never
  //                drag, not even their own appointments.
  //   file       - the technician who was actually on site is the one who
  //                writes the report and records materials, so that stays.
  const isTechnician = currentUser?.role === ROLES.TECHNICIAN;
  const canReschedule = !isTechnician;
  // The office plans from the side panel; a technician's view is their own
  // schedule, so it keeps the plain legend instead.
  const showSidePanel = !isTechnician;
  // A technician "owns" a visit they are on, lead or not — an appointment can
  // carry a crew since migration 041.
  const ownsAppointment = (appointment) => !isTechnician || isAssignedTo(appointment, currentUser?.id);

  const selected = appointments.find((appointment) => appointment.id === selectedId && ownsAppointment(appointment)) || null;
  const selectedClient = clients.find((client) => client.id === selected?.clientId) || null;
  useEffect(() => {
    const requestedId = searchParams.get("appointment");
    const requestedAppointment = appointments.find((appointment) => appointment.id === requestedId);
    if (!requestedAppointment || (isTechnician && !isAssignedTo(requestedAppointment, currentUser?.id))) return;
    setSelectedId(requestedId);
    if (searchParams.get("tab") === "Report") setTab("Report");
  }, [appointments, searchParams, isTechnician, currentUser?.id]);
  // The top bar's "New visit" (and a client's "Book visit") land here with
  // ?new=1, optionally &client=<id>. Open the form once, then drop the
  // params so a refresh or Back doesn't reopen it.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    if (!isTechnician) {
      setCreateClientId(searchParams.get("client") || "");
      setCreateScheduledAt("");
      setCreateOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("client");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isTechnician]);
  // Every account, inactive included, for resolving names on visits already
  // booked. Booking itself only offers `bookableTechnicians`.
  const allAccounts = useMemo(() => [...staff, ...technicians], [staff, technicians]);
  // Who can be put on a visit: deactivated accounts are never offered.
  const activeTechnicians = useMemo(() => bookableTechnicians(technicians), [technicians]);

  useEffect(() => {
    setTreatmentMethods(selected?.treatmentMethods || []);
  }, [selectedId, selected?.treatmentMethods]);

  const toggleTreatmentMethod = (value) => {
    setTreatmentMethods((current) => current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]);
  };

  const weekStart = startOfWeek(anchorDate);
  const weekStartTime = weekStart.getTime();
  const anchorDayKey = localDateKey(anchorDate);
  // The columns the grid draws: the whole week, or just the anchor day.
  const weekDays = useMemo(() => {
    if (mode === MODES.DAY) {
      const day = new Date(anchorDate);
      day.setHours(0, 0, 0, 0);
      return [day];
    }
    return Array.from({ length: 7 }, (_, index) => addDays(new Date(weekStartTime), index));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, weekStartTime, anchorDayKey]);
  const monthCells = useMemo(() => {
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [anchorDate]);
  const visibleAppointments = useMemo(() => {
    const term = appointmentSearch.trim().toLowerCase();
    return appointments.filter((appointment) => {
      // Technicians see only what is assigned to them. Not a default, not a
      // filter they can widen — nothing else in this list can reach past it.
      if (isTechnician && !isAssignedTo(appointment, currentUser?.id)) return false;
      const client = clients.find((entry) => entry.id === appointment.clientId);
      const crewNames = crewOf(appointment)
        .map((id) => allAccounts.find((account) => account.id === id))
        .map((account) => account?.name || account?.username || "")
        .join(" ");
      const text = `${appointment.id} ${client?.name || ""} ${client?.address || ""} ${appointment.pestConcern || ""} ${appointment.status} ${crewNames}`.toLowerCase();
      return (!term || text.includes(term))
        && (technicianFilter === "ALL" || isAssignedTo(appointment, technicianFilter))
        && (statusFilter === "ALL" || appointment.status === statusFilter)
        && (clientFilter === "ALL" || appointment.clientId === clientFilter)
        && (pestConcernFilter === "ALL" || appointment.pestConcern === pestConcernFilter)
        // Compared as local date keys so a boundary date includes the whole day
        // regardless of the appointment's time.
        && (!dateFrom || localDateKey(new Date(appointment.scheduledAt)) >= dateFrom)
        && (!dateTo || localDateKey(new Date(appointment.scheduledAt)) <= dateTo);
    });
  }, [appointments, appointmentSearch, clients, allAccounts, technicianFilter, statusFilter, clientFilter, pestConcernFilter, dateFrom, dateTo, isTechnician, currentUser?.id]);

  const pestConcernOptions = useMemo(
    () => Array.from(new Set(appointments.filter(ownsAppointment).map((appointment) => appointment.pestConcern).filter(Boolean))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, isTechnician, currentUser?.id]
  );

  // One layout pass per visible day, not per card. Appointments starting
  // outside the rendered hours are counted separately so they can be flagged
  // in the day header rather than silently dropped.
  const weekLayout = useMemo(() => {
    const byDay = new Map();
    weekDays.forEach((date) => byDay.set(localDateKey(date), { inRange: [], outside: [] }));

    visibleAppointments.forEach((appointment) => {
      const date = new Date(appointment.scheduledAt);
      const bucket = byDay.get(localDateKey(date));
      if (!bucket) return;
      if (date.getHours() < DAY_START_HOUR || date.getHours() >= CALENDAR_END_HOUR) bucket.outside.push(appointment);
      else bucket.inRange.push(appointment);
    });

    const result = new Map();
    byDay.forEach((bucket, key) => {
      result.set(key, {
        ...layoutDayAppointments(bucket.inRange, { maxColumns: MAX_CARD_COLUMNS }),
        outside: bucket.outside,
      });
    });
    return result;
  }, [weekDays, visibleAppointments]);


  // The hours the grid actually draws. A week with four appointments used to
  // render all thirteen business hours at a fixed 56px — 728px of mostly
  // empty ruled paper, which is the loudest thing wrong with the old screen.
  //
  // The office's day, 7 AM – 6 PM, is always on screen so there is somewhere
  // to drop a visit; the window only widens (never narrows) to reach a visit
  // booked outside it, so nothing is ever hidden.
  const hourWindow = useMemo(() => {
    if (showAllHours) return fullDayWindow(DAY_START_HOUR, CALENDAR_END_HOUR);
    const inView = visibleAppointments.filter((appointment) =>
      weekDays.some((date) => localDateKey(date) === localDateKey(new Date(appointment.scheduledAt)))
    );
    const base = fullDayWindow(DAY_START_HOUR, SCHEDULE_END_HOUR);
    if (inView.length === 0) return base;
    const used = visibleHourWindow(inView, { businessStart: DAY_START_HOUR, businessEnd: CALENDAR_END_HOUR, pad: 0, minHours: 1 });
    return { startHour: Math.min(base.startHour, used.startHour), endHour: Math.max(base.endHour, used.endHour) };
  }, [visibleAppointments, weekDays, showAllHours]);

  // Fewer hours on screen means each can afford more height, which is what
  // makes a readable card possible at all.
  const rowHeight = useMemo(() => rowHeightForWindow(hoursIn(hourWindow).length), [hourWindow]);

  /**
   * Move the dragged appointment to `dateKey`.
   *
   * `time` is optional because a month cell has no vertical position to read
   * one from. It used to default to "09:00", which meant dropping a 3 PM
   * visit anywhere in a month cell silently rebooked it to 9 AM — no warning,
   * no undo, and nothing in the UI to suggest the time had changed at all.
   * Leaving it undefined now keeps the appointment's own time of day, so a
   * month drag changes the date and nothing else.
   */
  // Moves a visit to a new start and puts its status back as it was.
  //
  // update_appointment (migration 047) only lets the time change while the
  // row is in Reschedule, so a move is two writes: hop to Reschedule, then
  // save the new time with the ORIGINAL status. The drop used to save
  // "Confirmed" here, which silently confirmed Pending visits nobody had
  // agreed to. If the second write fails, the first is undone so the visit
  // isn't left stranded in Reschedule. Returns an error string or null.
  const relocate = async (current, scheduledAt) => {
    const steps = moveSteps(current, scheduledAt);
    for (let index = 0; index < steps.length; index += 1) {
      const result = await updateAppointment(steps[index]);
      if (typeof result === "string") {
        if (index > 0) await updateAppointment({ ...current, status: current.status });
        return result;
      }
    }
    return null;
  };

  const refuseMove = (reason) => {
    setDraggedId(null);
    showError(reason);
    setMessage(reason);
  };

  const moveAppointment = async (dateKey, time = null) => {
    if (!draggedId) return;
    const current = appointments.find((appointment) => appointment.id === draggedId);
    if (!canReschedule) {
      refuseMove("Rescheduling is handled by the office. Ask staff to move this visit.");
      return;
    }
    if (!current) {
      setDraggedId(null);
      return;
    }
    const keptTime = minutesToTimeValue(minutesOfDay(current.scheduledAt));
    const nextScheduledAt = `${dateKey}T${time || keptTime}:00`;
    const movedAppointment = { ...current, scheduledAt: nextScheduledAt };
    // Refused before anything is written: the Reschedule step would otherwise
    // land and strand the visit in that status (migration 047).
    if (validateAppointmentStart(nextScheduledAt)) {
      refuseMove("Appointments cannot be moved into the past.");
      return;
    }
    // A finished or cancelled visit has no slot to move to, even though the
    // status rules would let a cancelled one through Reschedule.
    if (current.status === "Cancelled" || !canTransition(current.status, "Reschedule")) {
      refuseMove(`A ${current.status.toLowerCase()} appointment cannot be moved.`);
      return;
    }
    const dropRefusal = describeSlotConflict(appointments, movedAppointment);
    if (dropRefusal) {
      refuseMove(dropRefusal);
      return;
    }
    const failure = await relocate(current, nextScheduledAt);
    setDraggedId(null);
    if (failure) {
      showError(failure);
      setMessage(failure);
      return;
    }

    const moved = `Moved to ${formatDateTime(nextScheduledAt)}. Still ${current.status}.`;
    setMessage(moved);
    // Undo puts it back where it was — unless that slot is now in the past,
    // which update_appointment would refuse.
    const canUndo = !validateAppointmentStart(current.scheduledAt);
    showSuccess(
      moved,
      canUndo
        ? {
            action: {
              label: "Undo",
              onClick: async () => {
                const undoFailure = await relocate({ ...current, scheduledAt: nextScheduledAt }, current.scheduledAt);
                if (undoFailure) showError(undoFailure);
                setMessage(undoFailure || `Moved back to ${formatDateTime(current.scheduledAt)}.`);
              },
            },
          }
        : undefined
    );
  };

  const navigateCalendar = (amount) => {
    const next = new Date(anchorDate);
    if (mode === MODES.MONTH) next.setMonth(next.getMonth() + amount);
    else if (mode === MODES.DAY) next.setDate(next.getDate() + amount);
    else next.setDate(next.getDate() + amount * 7);
    setAnchorDate(next);
  };

  const handleManualSave = async (event, technicianIds) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextValue = form.get("scheduledAt");
    const nextScheduledAt = new Date(nextValue).toISOString();
    const nextDuration = readDuration(form);
    const nextStatus = form.get("status");
    const timingChanged = new Date(nextScheduledAt).getTime() !== new Date(selected.scheduledAt).getTime()
      || nextDuration !== (Number(selected.durationMinutes) || 60);
    const guard =
      (timingChanged && new Date(nextScheduledAt).getTime() !== new Date(selected.scheduledAt).getTime() && validateAppointmentStart(nextScheduledAt)
        ? "Appointments cannot be moved into the past."
        : null) ||
      (timingChanged ? validateDuration(nextDuration) : null) ||
      validateMoney(form.get("price"), { label: "Price" });
    if (guard) {
      showError(guard);
      setMessage(guard);
      return;
    }
    // The select holds a service id; the appointment stores the name as its
    // snapshot. LEGACY_SERVICE keeps a name whose profile is gone.
    const chosenService = form.get("serviceId");
    const nextService = chosenService === LEGACY_SERVICE
      ? { serviceId: "", serviceType: selected.serviceType }
      : { serviceId: chosenService || "", serviceType: serviceById(chosenService)?.name || "" };
    const candidate = {
      ...selected,
      scheduledAt: nextScheduledAt,
      durationMinutes: nextDuration,
      technicianIds,
    };
    // Cancelling a visit should not be blocked by the slot it used to hold.
    if (form.get("status") !== "Cancelled") {
      const refusal = describeSlotConflict(appointments, candidate);
      if (refusal) {
        showError(refusal);
        setMessage(refusal);
        return;
      }
    }

    // The database checks the existing status before accepting a time change,
    // so legacy after-hours appointments need the same two-step transition as
    // drag-and-drop: mark Reschedule first, then save the new time.
    if (timingChanged && selected.status !== "Reschedule") {
      if (nextStatus !== "Reschedule") {
        const refusal = "Set the status to Reschedule before changing the date, time, or duration.";
        showError(refusal);
        setMessage(refusal);
        return;
      }
      const prepareResult = await updateAppointment({ ...selected, technicianIds, status: "Reschedule" });
      if (typeof prepareResult === "string") {
        showError(prepareResult);
        setMessage(prepareResult);
        return;
      }
    }

    const result = await updateAppointment({
      ...selected,
      scheduledAt: nextScheduledAt,
      durationMinutes: nextDuration,
      pestConcern: form.get("pestConcern"),
      ...nextService,
      serviceLocation: form.get("serviceLocation") || "",
      technicianIds,
      serviceFrequency: form.get("serviceFrequency") || "",
      price: form.get("price") || "",
      status: nextStatus,
      notes: form.get("notes"),
      cancellationReason: form.get("cancellationReason") || "",
    });
    if (typeof result === "string") showError(result);
    setMessage(typeof result === "string" ? result : "Appointment details updated.");
  };

  /**
   * One handler for both buttons. `confirmation` is null for a plain save —
   * which stores the report and leaves the appointment's status alone — or
   * carries the customer's signature, or an office override reason.
   */
  const handleReportSubmit = async (formElement, confirmation = null) => {
    const form = new FormData(formElement);
    const report = {
      findings: (form.get("findings") || "").trim(),
      treatmentPerformed: (form.get("treatmentPerformed") || "").trim(),
      recommendations: (form.get("recommendations") || "").trim(),
      followUpDate: form.get("followUpDate") || "",
      treatmentMethods,
    };
    if (!report.findings) {
      showError("Inspection findings are required.");
      return;
    }
    if (treatmentMethods.length === 0 && !report.treatmentPerformed) {
      showError("Record the treatment: tick at least one method, or describe it in the notes.");
      return;
    }

    // The signature image is uploaded first; only its object key reaches the
    // report, so a failed upload never completes a visit.
    if (confirmation?.signatureFile) {
      const upload = await uploadSignature(selected.id, confirmation.signatureFile);
      if (upload.error) {
        showError(upload.error);
        return;
      }
      report.signaturePath = upload.storagePath;
      report.customerName = confirmation.customerName;
    }
    if (confirmation?.completionNote) report.completionNote = confirmation.completionNote;

    // The technician's signature is their attestation of this report. It is
    // uploaded the same way but never completes the visit on its own — only the
    // customer's signature or an office note does that.
    if (confirmation?.technicianSignatureFile) {
      const upload = await uploadSignature(selected.id, confirmation.technicianSignatureFile, "technician");
      if (upload.error) {
        showError(upload.error);
        return;
      }
      report.technicianSignaturePath = upload.storagePath;
    }

    const result = await submitReport(selected.id, report);
    if (typeof result === "string") {
      showError(result);
      setMessage(result);
      return;
    }
    setMessage(confirmation
      ? "Completion confirmed. Service marked Completed."
      : "Report saved. Confirm completion with the customer's signature to close this visit.");
  };

  const printServiceForm = (appointment) => {
    const client = clients.find((entry) => entry.id === appointment.clientId);
    if (!client) {
      showError("That client could not be loaded, so the form cannot be printed.");
      return;
    }
    setPrintRequest({
      appointment,
      client,
      technician: allAccounts.find((account) => account.id === appointment.technicianId) || null,
      technicians: crewOf(appointment)
        .map((id) => allAccounts.find((account) => account.id === id))
        .filter(Boolean),
      inventory,
    });
  };

  /**
   * Open the create form prefilled for a follow-up visit.
   *
   * This was unreachable. It set the client id and opened the modal but never
   * closed the detail panel, and the panel's backdrop sat at a HIGHER
   * z-index than the create modal — so the form opened behind the panel that
   * launched it, invisible and unclickable. It also ignored the follow-up
   * date the technician had just entered on the report, which is the one
   * piece of information the whole action exists to carry forward.
   */
  const scheduleFollowUp = () => {
    if (!selected) return;
    setSelectedId(null);
    setCreateClientId(selected.clientId);
    setCreateScheduledAt(
      selected.followUpDate
        ? toDateTimeLocal(new Date(`${selected.followUpDate}T09:00:00`))
        : ""
    );
    setCreateOpen(true);
  };

  // StockOutForm validates and owns its rows; this records them. Returns true
  // or the error string, so the form knows whether to clear itself.
  const handleStockSubmit = async ({ entries, date }) => {
    const result = await stockOutMany(selected.id, entries, date);
    if (typeof result === "string") {
      showError(result);
      setMessage(result);
      return result;
    }
    entries.forEach((entry) => {
      const item = inventory.find((candidate) => candidate.id === entry.itemId);
      addStockUsed(selected.id, { itemId: entry.itemId, name: item?.name || "Inventory item", amount: entry.amount, unit: item?.unit || "", batchNumber: entry.batchNumber, date });
    });
    setMessage(`${entries.length} stock item${entries.length === 1 ? "" : "s"} recorded as OUT for this appointment.`);
    return true;
  };

  const handleCreate = async (fields) => {
    const refusal = describeSlotConflict(appointments, fields);
    if (refusal) return refusal;
    const result = await createAppointment(fields);
    if (typeof result === "string") return result;
    setCreateOpen(false);
    setSelectedId(result.id);
    setCreateScheduledAt("");
    setCreateClientId("");
    setCreatePrefill(null);
    // Show the new visit where it landed, in the day view if that's open.
    if (mode !== MODES.DAY) setMode(MODES.WEEK);
    setAnchorDate(mode === MODES.DAY ? new Date(result.scheduledAt) : startOfWeek(new Date(result.scheduledAt)));
    setMessage("Appointment created.");
    return true;
  };

  // Book the next visit for a client due for re-service: their last visit's
  // service, frequency and pest concern come along; the time is where the
  // card was dropped, or the form's default when it was clicked.
  const bookReservice = (entry, scheduledAt) => {
    setCreateClientId(entry.client.id);
    setCreateScheduledAt(scheduledAt);
    setCreatePrefill({
      serviceId: entry.last.serviceId || "",
      frequency: entry.last.serviceFrequency || "",
      pestConcern: entry.last.pestConcern || "",
    });
    setCreateOpen(true);
  };

  const handleGridDrop = (dateKey, time) => {
    if (reserviceDrag) {
      const entry = reserviceDrag;
      setReserviceDrag(null);
      bookReservice(entry, toDateTimeLocal(new Date(`${dateKey}T${time}:00`)));
      return;
    }
    moveAppointment(dateKey, time);
  };

  const openCreateAt = (dateKey, time) => {
    setCreateScheduledAt(toDateTimeLocal(new Date(`${dateKey}T${time}:00`)));
    setCreateOpen(true);
  };

  // `height` is the card's real pixel height in the week grid. Content is
  // chosen to fit it, because the card clips — a 15-minute visit that tried to
  // render four stacked rows showed only the first one and lost its status.
  // Everything the calendar's cards need, in one value rather than threaded
  // through WeekGrid and its day layers as nine separate props.
  const calendarValue = useMemo(
    () => ({
      clients,
      accounts: allAccounts,
      selectedId,
      draggedId,
      canReschedule,
      onSelect: (appointment) => {
        // A finished drag also fires a click; the ref is what tells them apart.
        if (draggedCardRef.current) {
          draggedCardRef.current = false;
          return;
        }
        setSelectedId(appointment.id);
        setTab("Overview");
      },
      onDragStart: (appointment) => {
        draggedCardRef.current = false;
        setDraggedId(appointment.id);
      },
      onDragEnd: () => {
        draggedCardRef.current = true;
        setDraggedId(null);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, allAccounts, selectedId, draggedId, canReschedule]
  );

  const appointmentsOnDay = (dateKey) =>
    visibleAppointments.filter(
      (appointment) => localDateKey(new Date(appointment.scheduledAt)) === dateKey
    );

  const jobsThisWeek = (technicianId) =>
    visibleAppointments.filter((appointment) =>
      technicianId === null ? crewOf(appointment).length === 0 : isAssignedTo(appointment, technicianId)
    ).length;

  const weekEnd = addDays(weekStart, 6);
  const rangeLabel =
    mode === MODES.MONTH
      ? anchorDate.toLocaleDateString([], { month: "long", year: "numeric" })
      : mode === MODES.DAY
        ? anchorDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })
        : weekRangeLabel(weekStart, weekEnd);

  const isOnToday =
    mode === MODES.MONTH
      ? anchorDate.getMonth() === now.getMonth() && anchorDate.getFullYear() === now.getFullYear()
      : mode === MODES.DAY
        ? anchorDayKey === localDateKey(now)
        : localDateKey(weekStart) === localDateKey(startOfWeek(now));

  return (
    <div style={pageShell}>
      <PageHeader eyebrow="Operations" title="Schedule" />

      <div style={{ display: "grid", gap: "15px" }}>
        <SchedulingToolbar
          mode={mode}
          onModeChange={setMode}
          rangeLabel={rangeLabel}
          onNavigate={navigateCalendar}
          onToday={() => setAnchorDate(new Date())}
          isOnToday={isOnToday}
          technicians={activeTechnicians}
          technicianFilter={technicianFilter}
          onTechnicianFilterChange={setTechnicianFilter}
          countFor={jobsThisWeek}
          isTechnician={isTechnician}
        />

        <section style={{ ...card, padding: mode === MODES.LIST ? "20px" : 0, border: mode === MODES.LIST ? undefined : "none", background: mode === MODES.LIST ? undefined : "transparent" }}>
          {mode === MODES.LIST && (
            <div style={{ ...sunkenPanel, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", alignItems: "end", marginBottom: "15px" }}>
              <Field label="Search appointments" style={{ gridColumn: "span 2" }}>
                <Input
                  value={appointmentSearch}
                  onChange={(event) => setAppointmentSearch(event.target.value)}
                  placeholder="Client, address, technician, pest concern, ID"
                />
              </Field>
              {!isTechnician && (
                <Field label="Technician">
                  <Select value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>
                    <option value="ALL">All technicians</option>
                    {activeTechnicians.map((account) => (
                      <option key={account.id} value={account.id}>{account.name || account.username}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Status">
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">All statuses</option>
                  {APPOINTMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </Select>
              </Field>
              <Field label="Client">
                <Select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
                  <option value="ALL">All clients</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </Select>
              </Field>
              <Field label="Pest concern">
                <Select value={pestConcernFilter} onChange={(event) => setPestConcernFilter(event.target.value)}>
                  <option value="ALL">All pest concerns</option>
                  {pestConcernOptions.map((concern) => <option key={concern} value={concern}>{concern}</option>)}
                </Select>
              </Field>
              <Field label="Date from">
                <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
              </Field>
              <Field label="Date to">
                <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
              </Field>
              {(dateFrom || dateTo) && (
                <Button size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ alignSelf: "end" }}>
                  Clear dates
                </Button>
              )}
            </div>
          )}

          <CalendarProvider value={calendarValue}>
            {mode === MODES.LIST && (
              <AppointmentListView
                appointments={visibleAppointments}
                clients={clients}
                accounts={allAccounts}
                onSelect={(id) => { setSelectedId(id); setTab("Overview"); }}
              />
            )}

            {(mode === MODES.WEEK || mode === MODES.DAY) && (
              <div className={showSidePanel ? "schedule-layout" : undefined}>
              <WeekGrid
                weekDays={weekDays}
                loadFor={(key) => dayLoad(visibleAppointments, key, Math.max(1, activeTechnicians.length))}
                now={now}
                weekLayout={weekLayout}
                window={hourWindow}
                rowHeight={rowHeight}
                dayStartHour={DAY_START_HOUR}
                dayEndHour={DAY_END_HOUR}
                onEmptyClick={openCreateAt}
                onDropAt={handleGridDrop}
                onShowOverflow={setOverflowGroup}
                onShowAllHours={() => setShowAllHours(true)}
              />
              {showSidePanel && (
                <ScheduleSidePanel
                  reschedule={awaitingReschedule(visibleAppointments)}
                  reservice={reserviceDue(appointments, clients, now, 14)}
                  load={activeTechnicians.map((technician) => ({
                    technician,
                    hours: technicianHours(appointments, technician.id, { start: weekStart, end: addDays(weekStart, 7) }),
                  }))}
                  clientName={(id) => clients.find((client) => client.id === id)?.name || "Unknown client"}
                  canDrag={canReschedule}
                  onDragAppointment={(appointment) => {
                    setReserviceDrag(null);
                    setDraggedId(appointment.id);
                  }}
                  onDragReservice={(entry) => {
                    setDraggedId(null);
                    setReserviceDrag(entry);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setReserviceDrag(null);
                  }}
                  onOpenAppointment={(appointment) => {
                    setSelectedId(appointment.id);
                    setTab("Overview");
                  }}
                  onBookReservice={(entry) => bookReservice(entry, "")}
                />
              )}
              </div>
            )}

            {mode === MODES.MONTH && (
              <MonthGrid
                monthCells={monthCells}
                anchorDate={anchorDate}
                appointmentsFor={appointmentsOnDay}
                onDropAt={moveAppointment}
              />
            )}
          </CalendarProvider>

          {isCalendarMode(mode) && !(showSidePanel && mode !== MODES.MONTH) && (
            <div style={{ marginTop: "12px" }}>
              <CalendarLegend
                note={canReschedule ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <GripVertical size={14} aria-hidden="true" /> Drag a visit to move it. Its status is kept, and you can undo.
                  </span>
                ) : null}
              />
            </div>
          )}
          {!canReschedule && (
            <div style={{ display: "flex", gap: "8px", color: colors.muted, fontSize: "12.5px", marginTop: "10px", alignItems: "center" }}>
              <Lock size={14} aria-hidden="true" /> This is your assigned schedule. Contact the office to change a visit — you can still file reports and materials from the Report and Stock-Out tabs.
            </div>
          )}
          {loading && <div role="status" style={{ marginTop: "0.75rem", color: colors.muted, fontWeight: 500, fontSize: "0.82rem" }}>Loading appointments...</div>}
          {(message || error) && <div role="status" style={{ marginTop: "0.75rem", color: error ? colors.danger : colors.success, fontWeight: 500, fontSize: "0.82rem" }}>{error || message}</div>}
          {clients.length === 0 && <div style={{ padding: "2rem 1rem", textAlign: "center", color: colors.muted }}>Client profiles will appear here once they are loaded.</div>}
          {appointmentSearch && visibleAppointments.length === 0 && <div style={{ padding: "1rem", textAlign: "center", color: colors.muted }}>No appointments match this search.</div>}
        </section>
      </div>
      {selected && selectedClient && (
        <AppointmentPanel
          /* Remounting on save is what resets the uncontrolled report form. */
          key={`${selected.id}-${selected.status}-${selected.updatedAt || ""}`}
          appointment={selected}
          client={selectedClient}
          appointments={appointments}
          activeAccounts={bookableTechnicians(technicians, crewOf(selected))}
          ui={{ tab, setTab, onClose: () => setSelectedId(null) }}
          access={{
            canReschedule,
            canFileService: ownsAppointment(selected),
            canUpload: can("clientDocuments", "create") && ownsAppointment(selected),
            canRemove: can("clientDocuments", "delete") && ownsAppointment(selected),
            assignedName: crewOf(selected)
              .map((id) => allAccounts.find((account) => account.id === id))
              .map((account) => account?.name || account?.username)
              .filter(Boolean)
              .join(", ") || "another technician",
          }}
          report={{
            treatmentMethods,
            onToggleMethod: toggleTreatmentMethod,
            dynamicMethods,
            dynamicGroups,
            getSignatureUrl,
            onReportSubmit: handleReportSubmit,
            onPrintServiceForm: () => printServiceForm(selected),
          }}
          files={{
            addDocument,
            removeDocument,
            getDocumentUrl,
            addAttachment,
            removeAttachment,
            getAttachmentUrl,
          }}
          actions={{
            onSave: handleManualSave,
            onStockSubmit: handleStockSubmit,
            onScheduleFollowUp: scheduleFollowUp,
            onProblem: showError,
          }}
          stock={{ inventory, service: serviceById(selected.serviceId) || serviceByName(selected.serviceType), services: activeServices, serviceById, serviceByName }}
        />
      )}
      <ServiceReportPrinter request={printRequest} onDone={() => setPrintRequest(null)} onProblem={showError} getAttachmentUrl={getAttachmentUrl} getSignatureUrl={getSignatureUrl} />
      {createOpen && (
        <NewAppointmentModal
          clients={clients}
          activeAccounts={activeTechnicians}
          appointments={appointments}
          services={activeServices}
          initialClientId={createClientId}
          initialScheduledAt={createScheduledAt}
          initialServiceId={createPrefill?.serviceId || ""}
          initialFrequency={createPrefill?.frequency || ""}
          initialPestConcern={createPrefill?.pestConcern || ""}
          onClose={() => {
            setCreateOpen(false);
            setCreateClientId("");
            setCreateScheduledAt("");
            setCreatePrefill(null);
          }}
          onCreate={handleCreate}
        />
      )}
      {/* The "+N more" tile's contents. Cards carry the same technician
          colours as the grid, so the colour language survives the jump. */}
      <CalendarProvider value={calendarValue}>
        <OverflowDialog group={overflowGroup} onClose={() => setOverflowGroup(null)} />
      </CalendarProvider>
    </div>
  );
}

/** "Sep 21 – 27, 2026", "Sep 28 – Oct 4, 2026", "Dec 28, 2026 – Jan 3, 2027". */
export function weekRangeLabel(start, end) {
  const month = (date) => date.toLocaleDateString([], { month: "short" });
  if (start.getFullYear() !== end.getFullYear()) {
    return `${month(start)} ${start.getDate()}, ${start.getFullYear()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  const endPart = start.getMonth() === end.getMonth() ? `${end.getDate()}` : `${month(end)} ${end.getDate()}`;
  return `${month(start)} ${start.getDate()} – ${endPart}, ${end.getFullYear()}`;
}

function AppointmentOverviewForm({ appointment, client, activeAccounts, busyTechnicians, appointments, services = [], serviceById = () => null, serviceByName = () => null, onSave }) {
  const hours = Math.floor((appointment.durationMinutes || 60) / 60);
  const minutes = (appointment.durationMinutes || 60) % 60;
  const [technicianIds, setTechnicianIds] = useState(() => crewOf(appointment));
  const [status, setStatus] = useState(appointment.status);
  const conflicts = findTechnicianConflicts(appointments, { ...appointment, technicianIds });
  const statusOptions = allowedNextStatuses(appointment.status);
  const labelStyle = { fontSize: "0.76rem", color: colors.muted };
  const hintStyle = { color: colors.muted, fontSize: "0.7rem" };
  // The crew is React state, not a form field, so it is handed to the save
  // handler directly rather than read back out of FormData.
  const handleSubmit = (event) => onSave(event, technicianIds);
  // Pre-047 appointments carry only a name, so an exact name match adopts the
  // profile. A retired service stays selectable on the visit that uses it; a
  // name with no profile at all is kept as LEGACY_SERVICE so saving the form
  // never erases what the visit was booked as.
  const currentService = serviceById(appointment.serviceId) || serviceByName(appointment.serviceType);
  const serviceChoices = currentService && !services.some((service) => service.id === currentService.id)
    ? [...services, currentService]
    : services;
  const initialServiceValue = currentService?.id || (appointment.serviceType ? LEGACY_SERVICE : "");

  return <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
    <InfoRow icon={<UserRound size={15} />} label="Client contact" value={`${client.phone || "No phone"} ${client.email ? `• ${client.email}` : ""}`} />
    <InfoRow icon={<MapPin size={15} />} label="Service address" value={appointment.serviceLocation || client.address || "No address"} />
    <InfoRow icon={<UserRound size={15} />} label="Classification" value={client.classificationOther || client.classification || "Not classified"} />
    {/* Standing instructions for the account. Repeated on every visit on
        purpose: the point of recording them once is that nobody has to go
        looking for them before each job. */}
    {client.serviceNotes && <InfoRow icon={<FileText size={15} />} label="Service notes" value={client.serviceNotes} />}
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Date and time</strong><input name="scheduledAt" type="datetime-local" defaultValue={toDateTimeLocal(appointment.scheduledAt)} style={inputStyle} />{appointment.status !== "Reschedule" && <span style={hintStyle}>Set the status to Reschedule before changing the date, time, or duration.</span>}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontSize: "0.72rem", fontWeight: 500 }}>Hours<input name="durationHours" type="number" min="0" max="24" defaultValue={hours} style={{ ...inputStyle, padding: "0.55rem" }} required /></label><label style={{ display: "grid", gap: "0.25rem", color: colors.muted, fontSize: "0.72rem", fontWeight: 500 }}>Minutes<input name="durationMinutes" type="number" min="0" max="59" defaultValue={minutes} style={{ ...inputStyle, padding: "0.55rem" }} required /></label></div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Technicians</strong><TechnicianPicker accounts={activeAccounts} value={technicianIds} busyIds={busyTechnicians} onChange={setTechnicianIds} />{conflicts.length > 0 && <span style={{ color: colors.danger, fontSize: "0.72rem", fontWeight: 500 }}>Conflict: someone on this crew overlaps another appointment.</span>}</div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Service type</strong><select name="serviceId" aria-label="Service type" defaultValue={initialServiceValue} style={inputStyle}><option value="">Select a service type</option>{serviceChoices.map((service) => <option key={service.id} value={service.id}>{service.name}{service.isActive ? "" : " (retired)"}</option>)}{initialServiceValue === LEGACY_SERVICE && <option value={LEGACY_SERVICE}>{appointment.serviceType} (no longer in the catalog)</option>}</select></div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Service location</strong><input name="serviceLocation" maxLength={LIMITS.NOTES_MAX} defaultValue={appointment.serviceLocation || ""} placeholder={client.address || "Client address"} style={inputStyle} /><span style={hintStyle}>Leave blank to use the client's address.</span></div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Pest concern</strong><select name="pestConcern" defaultValue={appointment.pestConcern || ""} style={inputStyle}><option value="">Select a pest concern</option>{PEST_CONCERN_SUGGESTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
      <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Frequency</strong><select name="serviceFrequency" defaultValue={appointment.serviceFrequency || ""} style={inputStyle}><option value="">Not set</option>{SERVICE_FREQUENCIES.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
      <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Price (₱)</strong><input name="price" type="number" min="0" max={LIMITS.MAX_PRICE} step="0.01" defaultValue={appointment.price === "" || appointment.price === null || appointment.price === undefined ? "" : appointment.price} placeholder="0.00" style={inputStyle} /></div>
    </div>
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Status</strong><select name="status" value={status} onChange={(event) => setStatus(event.target.value)} style={inputStyle}>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>{statusOptions.length === 1 && <span style={hintStyle}>A {appointment.status.toLowerCase()} appointment cannot change status.</span>}</div>
    {status === "Cancelled" && <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Cancellation reason (optional)</strong><textarea name="cancellationReason" maxLength={LIMITS.NOTES_MAX} defaultValue={appointment.cancellationReason || ""} rows={2} placeholder="Why is this appointment being cancelled?" style={{ ...inputStyle, resize: "vertical" }} /></div>}
    <div style={{ display: "grid", gap: "0.4rem" }}><strong style={labelStyle}>Visit notes</strong><textarea name="notes" defaultValue={appointment.notes} rows={3} maxLength={LIMITS.NOTES_MAX} style={{ ...inputStyle, resize: "vertical" }} /></div>
    <button type="submit" style={primaryButton}><Check size={15} /> Save appointment</button>
  </form>;
}

function AppointmentListView({ appointments, clients, accounts, onSelect }) {
  return <div style={{ overflowX: "auto", border: "1px solid #efe9e0", borderRadius: "3.75px" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
      <thead><tr style={{ background: "#fcfaf1" }}>{["Date and time", "Client", "Technician", "Pest concern", "Status"].map((label) => <th key={label} style={{ padding: "0.75rem", color: colors.muted, fontSize: "0.7rem", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #efe9e0" }}>{label}</th>)}</tr></thead>
      <tbody>{appointments.map((appointment) => {
        const client = clients.find((entry) => entry.id === appointment.clientId);
        const crewNames = crewOf(appointment)
          .map((id) => accounts.find((entry) => entry.id === id))
          .map((entry) => entry?.name || entry?.username)
          .filter(Boolean);
        return <tr key={appointment.id} onClick={() => onSelect(appointment.id)} style={{ cursor: "pointer" }}>
          <td style={{ padding: "0.8rem 0.75rem", color: colors.ink, fontWeight: 500, borderBottom: "1px solid #f1e7e7" }}>{formatDateTime(appointment.scheduledAt)}</td>
          <td style={{ padding: "0.8rem 0.75rem", color: colors.body, borderBottom: "1px solid #f1e7e7" }}>{client?.name || "Unknown client"}</td>
          <td style={{ padding: "0.8rem 0.75rem", color: colors.body, borderBottom: "1px solid #f1e7e7" }}>{crewNames.join(", ") || "Unassigned"}</td>
          <td style={{ padding: "0.8rem 0.75rem", color: colors.body, borderBottom: "1px solid #f1e7e7" }}>{appointment.pestConcern || "Inspection"}</td>
          <td style={{ padding: "0.8rem 0.75rem", borderBottom: "1px solid #f1e7e7" }}><span style={badgeStyle(appointment.status)}>{appointment.status}</span></td>
        </tr>;
      })}</tbody>
    </table>
    {appointments.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: colors.muted }}>No appointments match the current filters.</div>}
  </div>;
}

const fieldsetReset = { border: 0, padding: 0, margin: 0, minWidth: 0 };

/**
 * The formal completion step. A report on its own is a draft; the visit only
 * closes when the customer signs, or when the office records why they could
 * not. Technicians never see the override.
 */
/**
 * The treatment as a checklist. Grouped so a long list stays scannable, with
 * the old free-text box kept underneath — a visit occasionally needs a sentence
 * that no fixed list will ever cover.
 */
function TreatmentMethods({ appointment, selected, onToggle, treatmentMethods, treatmentMethodGroups }) {
  return (
    <div
      className="p-4 bg-slate-50/60 border border-slate-200 rounded-xl flex flex-col gap-3"
      style={{
        padding: "1rem",
        background: "rgba(248, 250, 252, 0.6)",
        border: "1px solid #efe9e0",
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div>
        <strong style={{ color: colors.body, fontWeight: 500, fontSize: "0.82rem" }}>Treatment performed</strong>
        <div style={{ color: colors.muted, fontSize: "0.72rem", marginTop: "0.15rem" }}>
          Tick everything that was done. {selected.length > 0 ? `${selected.length} selected.` : "None selected yet."}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {treatmentMethodGroups.map((group) => (
          <div key={group}>
            <div
              style={{
                color: colors.muted,
                fontSize: "0.65rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderBottom: "1px solid #efe9e0",
                paddingBottom: "0.2rem",
                marginBottom: "0.35rem",
              }}
            >
              {group}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              {treatmentMethods.filter((method) => method.group === group).map((method) => {
                const on = selected.includes(method.value);
                return (
                  <label
                    key={method.value}
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      alignItems: "flex-start",
                      fontSize: "0.75rem",
                      color: on ? colors.ink : colors.body,
                      fontWeight: on ? 600 : 400,
                      cursor: "pointer",
                      padding: "0.15rem 0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(method.value)}
                      style={{ marginTop: "0.15rem", accentColor: colors.brand }}
                    />
                    <span style={{ lineHeight: 1.3 }}>{method.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The technician's own sign-off on the report they filed.
 *
 * Deliberately separate from CustomerConfirmation: this is an attestation, not
 * a confirmation of the service. Signing here saves the report but never marks
 * the visit Completed — only the customer's signature or an office note does
 * that, which is the rule the submit_appointment_report trigger enforces.
 */
function TechnicianSignature({ appointment, onSubmit, getSignatureUrl, onProblem }) {
  const padRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState("");

  const alreadySigned = Boolean(appointment.technicianSignaturePath);

  useEffect(() => {
    let cancelled = false;
    if (!appointment.technicianSignaturePath) { setSignatureUrl(""); return undefined; }
    getSignatureUrl(appointment.technicianSignaturePath).then((result) => {
      if (!cancelled && result?.url) setSignatureUrl(result.url);
    });
    return () => { cancelled = true; };
  }, [appointment.technicianSignaturePath, getSignatureUrl]);

  const sign = async (event) => {
    // Grab the form before awaiting: the synthetic event's currentTarget is
    // gone by the time toFile() resolves.
    const formElement = event.currentTarget.form;
    setBusy(true);
    const technicianSignatureFile = await padRef.current?.toFile();
    if (!technicianSignatureFile) {
      setBusy(false);
      onProblem?.("The signature could not be read from the pad. Please sign again.");
      return;
    }
    try {
      await onSubmit(formElement, { technicianSignatureFile });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col gap-2.5"
      style={{
        background: "rgba(236, 253, 245, 0.4)",
        border: "1px solid rgba(167, 243, 208, 0.8)",
        borderRadius: "0.75rem",
        padding: "0.875rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      <div>
        <h4 style={{ margin: 0, color: "#065f46", fontSize: "0.88rem", fontWeight: 500 }}>Technician signature</h4>
        <p style={{ margin: "0.2rem 0 0", color: "#4a6b4a", fontSize: "0.72rem" }}>
          {alreadySigned
            ? "You have signed off on this report."
            : "Sign to attest that the findings and treatment above are your own record of this visit."}
        </p>
      </div>

      {alreadySigned ? (
        <div style={{ padding: "0.65rem", borderRadius: "3.75px", background: "#ffffff", border: "1px solid #bbf7d0" }}>
          {signatureUrl
            ? <SignaturePreview url={signatureUrl} alt="Technician signature" name="Technician signature" imageStyle={{ background: "#fff", borderRadius: "3.75px" }} />
            : <div style={{ color: colors.muted, fontSize: "0.74rem" }}>Loading signature…</div>}
          {appointment.technicianSignedAt && <div style={{ marginTop: "0.35rem", color: "#4a6b4a", fontSize: "0.7rem" }}>{formatDateTime(appointment.technicianSignedAt)}</div>}
        </div>
      ) : (
        <>
          <SignaturePad ref={padRef} onChange={setHasInk} />
          <button
            type="button"
            onClick={sign}
            disabled={!hasInk || busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
            style={{ ...primaryButton, background: "#4a6b4a", borderColor: "#4a6b4a", justifyContent: "center", opacity: !hasInk || busy ? 0.55 : 1, cursor: !hasInk || busy ? "not-allowed" : "pointer" }}
          >
            {busy ? "Saving…" : "Sign report"}
          </button>
          {!hasInk && <div style={{ color: "#96897b", fontSize: "0.7rem", fontStyle: "italic" }}>Draw your signature above to enable this.</div>}
        </>
      )}
    </div>
  );
}

function CustomerConfirmation({ appointment, canOverride, onSubmit, onScheduleFollowUp, getSignatureUrl, onPrintServiceForm, onProblem }) {
  const padRef = useRef(null);
  const nameRef = useRef(null);
  const [customerName, setCustomerName] = useState(appointment.customerName || "");
  const [hasInk, setHasInk] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");

  const alreadySigned = Boolean(appointment.signaturePath);
  const closed = appointment.status === "Completed";

  useEffect(() => {
    let cancelled = false;
    if (!appointment.signaturePath) { setSignatureUrl(""); return undefined; }
    getSignatureUrl(appointment.signaturePath).then((result) => {
      if (!cancelled && result?.url) setSignatureUrl(result.url);
    });
    return () => { cancelled = true; };
  }, [appointment.signaturePath, getSignatureUrl]);

  const run = async (formElement, confirmation) => {
    const form = formElement || document.getElementById("appointment-report-form");
    if (!form) return;
    setBusy(true);
    await onSubmit(form, confirmation);
    setBusy(false);
  };

  const confirmCompletion = async (event) => {
    // Grab the form before awaiting: the synthetic event's currentTarget is
    // gone by the time toFile() resolves.
    const formElement = event.currentTarget.form || document.getElementById("appointment-report-form");
    setBusy(true);
    const signatureFile = await padRef.current?.toFile();
    if (!signatureFile) {
      setBusy(false);
      onProblem?.("The signature could not be read from the pad. Please ask the customer to sign again.");
      return;
    }
    try {
      await onSubmit(formElement, { signatureFile, customerName: customerName.trim() });
    } finally {
      setBusy(false);
    }
  };

  const readyToConfirm = hasInk && agreed && customerName.trim().length > 0 && !busy;
  const missing = [
    customerName.trim() ? null : "the customer's name",
    hasInk ? null : "a signature",
    agreed ? null : "the confirmation tick",
  ].filter(Boolean);

  return (
    <div
      className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col gap-2.5"
      style={{
        background: "rgba(236, 253, 245, 0.4)",
        border: "1px solid rgba(167, 243, 208, 0.8)",
        borderRadius: "0.75rem",
        padding: "0.875rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      <div>
        <h4 style={{ margin: 0, color: "#065f46", fontSize: "0.88rem", fontWeight: 500 }}>Customer confirmation</h4>
        <p style={{ margin: "0.2rem 0 0", color: "#4a6b4a", fontSize: "0.72rem" }}>
          {closed ? "This service is completed." : "The visit is complete when the customer confirms the work."}
        </p>
      </div>

      {alreadySigned ? (
        <div style={{ padding: "0.65rem", borderRadius: "3.75px", background: "#ffffff", border: "1px solid #bbf7d0" }}>
          {signatureUrl
            ? <SignaturePreview url={signatureUrl} alt="Customer signature" name="Customer signature" imageStyle={{ background: "#fff", borderRadius: "3.75px" }} />
            : <div style={{ color: colors.muted, fontSize: "0.74rem" }}>Loading signature…</div>}
          <div style={{ marginTop: "0.35rem", color: "#4a6b4a", fontWeight: 500, fontSize: "0.76rem" }}>
            Signed by {appointment.customerName || "the customer"}
          </div>
          {appointment.signedAt && <div style={{ color: "#4a6b4a", fontSize: "0.7rem" }}>{formatDateTime(appointment.signedAt)}</div>}
        </div>
      ) : appointment.completionNote ? (
        <div style={{ padding: "0.65rem", borderRadius: "3.75px", background: "#faf0e2", border: "1px solid #fed7aa" }}>
          <div style={{ color: "#9a3412", fontWeight: 500, fontSize: "0.76rem" }}>Completed without a customer signature</div>
          <div style={{ marginTop: "0.2rem", color: colors.body, fontSize: "0.74rem", whiteSpace: "pre-wrap" }}>{appointment.completionNote}</div>
        </div>
      ) : (
        <>
          <label style={{ display: "grid", gap: "0.25rem", color: "#065f46", fontWeight: 500, fontSize: "0.76rem" }}>
            Customer name
            <input
              ref={nameRef}
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Printed name of person signing"
              style={{ ...inputStyle, borderColor: customerName.trim() || !hasInk ? undefined : "#e11d48", padding: "0.35rem 0.6rem", fontSize: "0.78rem" }}
            />
          </label>
          <SignaturePad ref={padRef} onChange={setHasInk} />
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start", color: "#065f46", fontSize: "0.74rem" }}>
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} style={{ marginTop: "0.15rem", accentColor: "#4a6b4a" }} />
            <span>The customer confirms the service described above was performed.</span>
          </label>
          <button
            type="button"
            onClick={confirmCompletion}
            disabled={!readyToConfirm}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
            style={{ ...primaryButton, background: "#4a6b4a", borderColor: "#4a6b4a", justifyContent: "center", opacity: readyToConfirm ? 1 : 0.5, cursor: readyToConfirm ? "pointer" : "default" }}
          >
            <ShieldCheck size={14} style={{ marginRight: "0.25rem" }} /> Confirm completion
          </button>
        </>
      )}

      {!alreadySigned && !appointment.completionNote && missing.length > 0 && (
        <button
          type="button"
          onClick={() => nameRef.current?.focus()}
          style={{ display: "flex", gap: "0.45rem", alignItems: "center", textAlign: "left", width: "100%", padding: "0.45rem 0.6rem", borderRadius: "3.75px", background: "#f9ecea", border: "1px solid #fecdd3", color: "#9f1239", fontSize: "0.72rem", fontWeight: 500, cursor: "pointer" }}
        >
          <Lock size={12} style={{ flex: "none" }} />
          <span>Still needed: {missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.</span>
        </button>
      )}

      {!alreadySigned && !appointment.completionNote && canOverride && (
        overrideOpen ? (
          <div style={{ display: "grid", gap: "0.4rem", padding: "0.6rem", borderRadius: "3.75px", background: "#fffbeb", border: "1px solid #fde68a" }}>
            <strong style={{ color: "#a06a24", fontSize: "0.74rem" }}>Why is there no customer signature?</strong>
            <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={2} placeholder="e.g. Customer left before treatment finished; confirmed by phone." style={{ ...inputStyle, fontSize: "0.75rem", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button type="button" disabled={!overrideReason.trim() || busy} onClick={(event) => run(document.getElementById("appointment-report-form") || event.currentTarget.form, { completionNote: overrideReason.trim() })} style={{ ...primaryButton, padding: "0.3rem 0.6rem", fontSize: "0.72rem", opacity: overrideReason.trim() && !busy ? 1 : 0.5 }}>
                Complete without signature
              </button>
              <button type="button" onClick={() => setOverrideOpen(false)} style={{ ...secondaryButton, padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setOverrideOpen(true)} style={{ border: 0, background: "none", color: "#96897b", fontSize: "0.7rem", textDecoration: "underline", cursor: "pointer", padding: 0, textAlign: "left" }}>
            Customer cannot sign? Complete with a written reason
          </button>
        )
      )}
    </div>
  );
}

// The appointment detail opens as a centered modal using the same shell as the
// new-appointment form. As a side panel it squeezed the week and month grids
// into a narrow column, which is exactly the space those views need most.
const detailBackdrop = { position: "fixed", inset: 0, zIndex: 30, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.42)" };
const detailCard = {
  width: "min(100%, 768px)",
  maxHeight: "92vh",
  background: "#ffffff",
  borderRadius: "1rem",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  border: "1px solid #efe9e0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

/**
 * The appointment detail sheet.
 *
 * Thirty individual props became six grouped objects. They are destructured
 * straight back into the same local names, so the body below is untouched —
 * this is a call-site readability change, not a refactor of the panel.
 *
 * Deliberately NOT behind a context: it renders once, at one call site, and
 * its props are almost all callbacks, so a provider would add a layer without
 * removing a single argument.
 *
 * Three things in here are load-bearing and must survive any future change:
 *   - the `key` on the call site, which remounts the panel after a save and
 *     is what resets the uncontrolled report form;
 *   - the `fieldset disabled` wrappers, which are the technician permission
 *     gate — a form moved outside one becomes editable by someone who may
 *     not edit it;
 *   - the `appointment-report-form` DOM id, which the signature components
 *     reach across component boundaries to submit.
 */
function AppointmentPanel({
  appointment,
  client,
  appointments,
  activeAccounts,
  ui,
  access,
  report,
  files,
  actions,
  stock,
}) {
  const { tab, setTab, onClose } = ui;
  const {
    canReschedule = true,
    canFileService = true,
    canUpload,
    canRemove,
    assignedName,
  } = access;
  const {
    treatmentMethods,
    onToggleMethod,
    dynamicMethods,
    dynamicGroups,
    getSignatureUrl,
    onReportSubmit,
    onPrintServiceForm,
  } = report;
  const {
    addDocument,
    removeDocument,
    getDocumentUrl,
    addAttachment,
    removeAttachment,
    getAttachmentUrl,
  } = files;
  const { onSave, onStockSubmit, onScheduleFollowUp, onProblem } = actions;
  const { inventory, service, services, serviceById, serviceByName } = stock;

  const busyTechnicians = busyTechnicianIds(appointments, appointment);
  const notice = (text) => (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.7rem 0.8rem", marginBottom: "1rem", borderRadius: "3.75px", background: "#faf0e2", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "0.76rem", fontWeight: 500 }}>
      <Lock size={14} style={{ flex: "none", marginTop: "0.1rem" }} />
      <span>{text}</span>
    </div>
  );
  const scheduleNotice = !canReschedule && notice("Scheduling is handled by the office. Ask staff to change the time, technician, or status of this visit.");
  const serviceNotice = !canFileService && notice(`This visit is assigned to ${assignedName}. Only the assigned technician can file its report and materials.`);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Appointment detail for ${client.name}`} style={detailBackdrop}>
      <section
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        style={detailCard}
      >
        {/* 1. Header Bar */}
        <div
          className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0"
          style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #efe9e0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", flexShrink: 0 }}
        >
          <div>
            <div
              className="text-[11px] font-bold text-red-700 uppercase tracking-wider"
              style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#9a2d24", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Appointment detail
            </div>
            <h2
              className="text-lg font-bold text-slate-900 mt-0.5"
              style={{ margin: "0.125rem 0 0", fontSize: "1.125rem", fontWeight: 500, color: "#211b15" }}
            >
              {client.name}
            </h2>
            <div
              className="text-xs text-slate-500 mt-0.5"
              style={{ fontSize: "0.75rem", color: "#96897b", marginTop: "0.125rem" }}
            >
              {formatDateTime(appointment.scheduledAt)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {onPrintServiceForm && (
              <button
                type="button"
                onClick={onPrintServiceForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 500, color: "#50463c", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", cursor: "pointer" }}
              >
                <Printer size={14} /> Generate service form PDF
              </button>
            )}
            <button
              type="button"
              aria-label="Close appointment detail"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              style={{ border: 0, background: "transparent", color: "#96897b", cursor: "pointer", padding: "0.375rem", display: "inline-flex", alignItems: "center", borderRadius: "0.5rem" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Tabs */}
        <div
          className="flex border-b border-slate-200 bg-white px-6 shrink-0 overflow-x-auto"
          style={{ display: "flex", borderBottom: "1px solid #efe9e0", background: "#ffffff", padding: "0 1.5rem", flexShrink: 0, overflowX: "auto" }}
        >
          {TAB_LABELS.map((label) => {
            const active = tab === label;
            return (
              <button
                type="button"
                key={label}
                onClick={() => setTab(label)}
                className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${active ? "border-red-700 text-red-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                style={{
                  border: 0,
                  borderBottom: active ? "2px solid #9a2d24" : "2px solid transparent",
                  padding: "0.75rem 1rem",
                  background: "transparent",
                  color: active ? "#9a2d24" : "#96897b",
                  fontWeight: 500,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* 3. Modal Body (Scrollable Container) */}
        <div
          className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0"
          style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1, minHeight: 0, overflowY: "auto" }}
        >
          {tab === "Overview" && (
            <>
              {scheduleNotice}
              <fieldset disabled={!canReschedule} style={fieldsetReset}>
                <AppointmentOverviewForm
                  key={appointment.id}
                  appointment={appointment}
                  client={client}
                  activeAccounts={activeAccounts}
                  busyTechnicians={busyTechnicians}
                  appointments={appointments}
                  services={services}
                  serviceById={serviceById}
                  serviceByName={serviceByName}
                  onSave={onSave}
                />
              </fieldset>
            </>
          )}

          {tab !== "Overview" && (
            <>
              {serviceNotice}
              <fieldset disabled={!canFileService} style={fieldsetReset}>
                {tab === "Documents" && (
                  <div>
                    <h2 style={{ marginTop: 0, marginBottom: "0.3rem", color: colors.body, fontSize: "1.05rem" }}>Client documents</h2>
                    <p style={{ margin: "0 0 0.9rem", color: colors.muted, fontSize: "0.74rem" }}>
                      Belongs to {client.name}, not to this visit. Photos and signed forms for this service go in the Report tab.
                    </p>
                    <div style={{ display: "grid", gap: "0.7rem" }}>
                      {DOCUMENT_CATEGORIES.map((category) => (
                        <ClientDocuments
                          key={category.value}
                          compact
                          title={category.label}
                          uploadLabel={category.uploadLabel}
                          documents={(client.documents || []).filter((document) => (document.category || "OTHER") === category.value)}
                          canUpload={canUpload}
                          canRemove={canRemove}
                          onUpload={(file) => addDocument(client.id, file, category.value)}
                          onRemove={(document) => removeDocument(client.id, document)}
                          onResolveUrl={getDocumentUrl}
                          emptyMessage="None uploaded yet."
                        />
                      ))}
                    </div>
                  </div>
                )}

                {tab === "Report" && (
                  <>
                    {/* Information callout banner */}
                    <div
                      className="p-3 mb-5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900 flex items-center gap-2"
                      style={{ padding: "0.75rem", marginBottom: "1.25rem", background: "rgba(239, 246, 255, 0.7)", border: "1px solid rgba(191, 219, 254, 0.6)", borderRadius: "0.75rem", fontSize: "0.75rem", color: "#1e3a8a", display: "flex", alignItems: "center", gap: "0.5rem" }}
                    >
                      <FileText size={15} className="shrink-0 text-blue-600" style={{ color: "#50463c", flexShrink: 0 }} />
                      <span>Required fields finalize this service. Recommendations and follow-up scheduling are optional.</span>
                    </div>

                    {/* 4. Two-Column Form Layout */}
                    <form id="appointment-report-form" onSubmit={(event) => event.preventDefault()} style={{ display: "grid", gap: "1.5rem" }}>
                      <div
                        className="grid grid-cols-1 md:grid-cols-2 gap-5"
                        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}
                      >
                        {/* Left Column (Notes & Details) */}
                        <div className="space-y-4" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                          <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 500, fontSize: "0.82rem" }}>
                            <span>Inspection findings <span style={{ color: "#9a2d24" }}>*</span></span>
                            <textarea
                              name="findings"
                              defaultValue={appointment.report}
                              rows={3}
                              placeholder="What did the technician observe?"
                              style={{ ...inputStyle, resize: "vertical", whiteSpace: "pre-wrap", width: "100%" }}
                              required
                            />
                          </label>

                          <label style={{ display: "grid", gap: "0.3rem", color: colors.body, fontWeight: 500, fontSize: "0.82rem" }}>
                            <span>
                              Additional treatment notes{" "}
                              <span style={{ fontWeight: 400, color: colors.muted, fontSize: "0.72rem" }}>
                                (Optional — anything the list does not cover)
                              </span>
                            </span>
                            <textarea
                              name="treatmentPerformed"
                              defaultValue={appointment.treatmentPerformed}
                              rows={2}
                              placeholder="e.g. Pipe chase behind the range needs sealing before the next visit."
                              style={{ ...inputStyle, resize: "vertical", whiteSpace: "pre-wrap", width: "100%" }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 500, fontSize: "0.82rem" }}>
                            Recommendations / follow-up notes
                            <textarea
                              name="recommendations"
                              defaultValue={appointment.recommendations}
                              rows={2}
                              placeholder="Optional recommendations"
                              style={{ ...inputStyle, resize: "vertical", width: "100%" }}
                            />
                          </label>

                          <label style={{ display: "grid", gap: "0.35rem", color: colors.body, fontWeight: 500, fontSize: "0.82rem" }}>
                            Follow-up date
                            <input
                              name="followUpDate"
                              type="date"
                              defaultValue={appointment.followUpDate}
                              style={{ ...inputStyle, width: "100%" }}
                            />
                          </label>
                        </div>

                        {/* Right Column (Checklist) */}
                        <TreatmentMethods
                          appointment={appointment}
                          selected={treatmentMethods}
                          onToggle={onToggleMethod}
                          treatmentMethods={dynamicMethods}
                          treatmentMethodGroups={dynamicGroups}
                        />
                      </div>

                      {/* 5. Signatures Grid */}
                      <div
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/80"
                        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(226, 232, 240, 0.8)" }}
                      >
                        <TechnicianSignature
                          appointment={appointment}
                          onSubmit={onReportSubmit}
                          getSignatureUrl={getSignatureUrl}
                          onProblem={onProblem}
                        />
                        <CustomerConfirmation
                          appointment={appointment}
                          canOverride={canReschedule}
                          onSubmit={onReportSubmit}
                          onScheduleFollowUp={onScheduleFollowUp}
                          getSignatureUrl={getSignatureUrl}
                          onPrintServiceForm={onPrintServiceForm}
                          onProblem={onProblem}
                        />
                      </div>
                    </form>

                    {/* 6. Report Attachments Section */}
                    <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid #efe9e0" }}>
                      <h3 style={{ margin: 0, color: colors.body, fontSize: "1rem", fontWeight: 500 }}>Report attachments</h3>
                      <p style={{ margin: "0.2rem 0 0.9rem", color: colors.muted, fontSize: "0.74rem" }}>
                        Files for this visit only. JPG, PNG, or PDF up to 5MB each.
                      </p>
                      <div
                        className="grid grid-cols-1 md:grid-cols-2 gap-3.5 overflow-hidden"
                        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.875rem", overflow: "hidden" }}
                      >
                        {ATTACHMENT_CATEGORIES.map((category) => (
                          <ClientDocuments
                            key={category.value}
                            variant="tile"
                            title={category.label}
                            uploadLabel={category.uploadLabel}
                            documents={(appointment.attachments || []).filter((attachment) => (attachment.category || "OTHER") === category.value)}
                            canUpload={canUpload}
                            canRemove={true}
                            onUpload={(file) => addAttachment(appointment.id, file, category.value)}
                            onRemove={(attachment) => removeAttachment({ ...attachment, appointmentId: attachment.appointmentId || appointment.id })}
                            onResolveUrl={getAttachmentUrl}
                            accept=".jpg,.jpeg,.png,.pdf"
                            validate={validateAttachment}
                            emptyMessage="None uploaded yet."
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tab === "Stock-Out" && (
                  <StockOutForm
                    key={appointment.id}
                    appointment={appointment}
                    inventory={inventory}
                    service={service}
                    onSubmit={onStockSubmit}
                  />
                )}
              </fieldset>
            </>
          )}
        </div>

        {/* 7. Sticky Footer Actions (Report tab) */}
        {tab === "Report" && (
          <div
            className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0"
            style={{ padding: "0.875rem 1.5rem", background: "#efe9e0", borderTop: "1px solid #efe9e0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}
          >
            <div>
              {appointment.followUpDate ? (
                <button
                  type="button"
                  onClick={onScheduleFollowUp}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.875rem", fontSize: "0.75rem", fontWeight: 500, color: "#50463c", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0.75rem", cursor: "pointer" }}
                >
                  Schedule follow-up
                </button>
              ) : <span />}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById("appointment-report-form");
                  if (form) onReportSubmit(form, null);
                }}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-red-700 hover:bg-red-800 text-white shadow-sm transition-colors cursor-pointer"
                style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, borderRadius: "0.75rem", background: "#9a2d24", color: "#ffffff", border: 0, cursor: "pointer", boxShadow: "none" }}
              >
                <Check size={15} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "0.35rem" }} />
                {appointment.reportSubmitted ? "Update report" : "Save report"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

let stockRowCounter = 0;
const newStockRow = (category, itemId = "", amount = "") => ({ id: `stock-row-${category}-${(stockRowCounter += 1)}`, category, itemId, amount: amount === "" ? "" : String(amount), batchNumber: "" });

/**
 * The date a stock-out for this visit defaults to: the visit's own day once it
 * has happened, today otherwise. Always editable, never later than today.
 */
export function defaultStockOutDate(appointment, now = new Date()) {
  const today = todayISO(now);
  const visitDay = appointment?.scheduledAt ? localDateKey(new Date(appointment.scheduledAt)) : today;
  return visitDay < today ? visitDay : today;
}

/**
 * Rows for the Stock-Out tab. With a service profile the materials it lists
 * come first, quantities filled in (migration 047); every category keeps at
 * least one row so an unlisted item can still be added.
 */
export function buildStockRows(service, inventory) {
  const byId = new Map(inventory.map((item) => [item.id, item]));
  const prefilled = (service?.materials || [])
    .map((material) => ({ material, item: byId.get(material.itemId) }))
    .filter(({ item }) => item && STOCK_CATEGORIES.includes(item.type))
    .map(({ material, item }) => newStockRow(item.type, item.id, material.defaultAmount));
  const missing = STOCK_CATEGORIES.filter((category) => !prefilled.some((row) => row.category === category));
  return [...prefilled, ...missing.map((category) => newStockRow(category))];
}

/**
 * Pure validation for a stock-out submission. Returns an error string, or
 * null with the rows ready to send.
 */
export function validateStockOut(rows, date, inventory) {
  const dateError = validateMovementDate(date);
  if (dateError) return { error: dateError };
  const entries = rows
    .filter((row) => row.itemId)
    .map((row) => ({ itemId: row.itemId, amount: Number(row.amount), batchNumber: (row.batchNumber || "").trim(), raw: row.amount }));
  if (entries.length === 0) return { error: "Select at least one item and enter a quantity greater than zero." };
  if (new Set(entries.map((entry) => entry.itemId)).size !== entries.length) return { error: "Select each inventory item only once per stock-out." };
  for (const entry of entries) {
    const item = inventory.find((candidate) => candidate.id === entry.itemId);
    const quantityError = validateQuantity(entry.raw, { label: `Quantity for ${item?.name || "an item"}` });
    if (quantityError) return { error: quantityError };
    if (item && entry.amount > Number(item.quantity)) return { error: `Only ${item.quantity} ${item.unit} of ${item.name} is in stock.` };
  }
  // eslint-disable-next-line no-unused-vars
  return { error: null, entries: entries.map(({ raw, ...entry }) => entry) };
}

function StockOutForm({ appointment, inventory, service, onSubmit }) {
  const alreadyRecorded = (appointment.stockUsed || []).length > 0;
  const hasProfile = Boolean(service?.materials?.length);
  const [rows, setRows] = useState(() => buildStockRows(hasProfile && !alreadyRecorded ? service : null, inventory));
  const [prefilled, setPrefilled] = useState(hasProfile && !alreadyRecorded);
  const [date, setDate] = useState(() => defaultStockOutDate(appointment));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  const updateRow = (rowId, field, value) => {
    setFormError("");
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, [field]: value } : row));
  };

  const addRow = (category) => setRows((current) => [...current, newStockRow(category)]);

  const removeRow = (rowId) => {
    setRows((current) => current.length <= STOCK_CATEGORIES.length ? current : current.filter((row) => row.id !== rowId));
  };

  const applyServiceDefaults = () => {
    setFormError("");
    setRows(buildStockRows(service, inventory));
    setPrefilled(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { error, entries } = validateStockOut(rows, date, inventory);
    if (error) {
      setFormError(error);
      return;
    }
    setSaving(true);
    const result = await onSubmit({ entries, date });
    setSaving(false);
    if (result === true) {
      setRows(buildStockRows(null, inventory));
      setPrefilled(false);
    } else if (typeof result === "string") {
      setFormError(result);
    }
  };

  const categoryLabel = (category) => category.charAt(0) + category.slice(1).toLowerCase();

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }} noValidate>
      <div style={{ padding: "0.85rem", borderRadius: "3.75px", background: "#faf0e2", color: "#9a3412", fontSize: "0.78rem" }}>
        <PackageCheck size={15} style={{ verticalAlign: "middle", marginRight: "0.35rem" }} /> Select every chemical, material, or equipment item used. All rows are submitted together.
      </div>

      {prefilled && service && (
        <div role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", padding: "0.7rem 0.85rem", borderRadius: "3.75px", border: `1px solid ${colors.line}`, background: colors.canvas, color: colors.body, fontSize: "0.78rem" }}>
          <span>Prefilled from the <strong>{service.name}</strong> service profile. Adjust the quantities to what was actually used before recording.</span>
        </div>
      )}
      {!prefilled && hasProfile && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", color: colors.muted, fontSize: "0.76rem" }}>
          <span>{alreadyRecorded ? "Materials were already recorded for this visit." : ""} {service.name} lists {service.materials.length} default material{service.materials.length === 1 ? "" : "s"}.</span>
          <button type="button" onClick={applyServiceDefaults} style={{ ...secondaryButton, padding: "0.4rem 0.6rem", fontSize: "0.72rem" }}>Use service defaults</button>
        </div>
      )}

      <label style={{ display: "grid", gap: "0.3rem", color: colors.ink, fontSize: "0.8rem", fontWeight: 500 }}>
        Date used
        <input
          type="date"
          aria-label="Stock-out date"
          value={date}
          max={today}
          onChange={(event) => { setFormError(""); setDate(event.target.value); }}
          style={{ ...inputStyle, padding: "0.55rem" }}
          required
        />
        <span style={{ color: colors.muted, fontSize: "0.7rem", fontWeight: 400 }}>Defaults to the visit's date. Change it to record materials used on an earlier day.</span>
      </label>

      {STOCK_CATEGORIES.map((category) => {
        const categoryRows = rows.filter((row) => row.category === category);
        const categoryItems = inventory.filter((item) => item.type === category && (item.status !== "DISABLED" || categoryRows.some((row) => row.itemId === item.id)));
        return (
          <section key={category} style={{ display: "grid", gap: "0.6rem", padding: "0.8rem", border: "1px solid #efe9e0", borderRadius: "3.75px", background: "#fcfaf1" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: colors.ink, fontSize: "0.82rem" }}>{categoryLabel(category)}</strong>
              <button type="button" onClick={() => addRow(category)} style={{ ...secondaryButton, padding: "0.4rem 0.6rem", fontSize: "0.72rem" }}><Plus size={13} /> Add item</button>
            </div>
            {categoryRows.map((row) => {
              const selectedItemIds = new Set(categoryRows.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.itemId).filter(Boolean));
              const item = inventory.find((candidate) => candidate.id === row.itemId);
              const short = item && Number(row.amount) > Number(item.quantity);
              const disabledItem = item?.status === "DISABLED";
              return (
                <div key={row.id} style={{ display: "grid", gap: "0.3rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 82px auto", gap: "0.45rem", alignItems: "center" }}>
                  <select aria-label={`${categoryLabel(category)} item`} value={row.itemId} onChange={(event) => updateRow(row.id, "itemId", event.target.value)} style={{ ...inputStyle, padding: "0.62rem 0.55rem", fontSize: "0.78rem" }}>
                    <option value="">Select item</option>
                    {categoryItems.map((option) => <option key={option.id} value={option.id} disabled={selectedItemIds.has(option.id)}>{option.name} ({option.quantity} {option.unit})</option>)}
                  </select>
                  <input aria-label={`${categoryLabel(category)} quantity`} type="number" min="0" max={LIMITS.MAX_MOVEMENT_QTY} step="any" value={row.amount} onChange={(event) => updateRow(row.id, "amount", event.target.value)} placeholder="Qty" style={{ ...inputStyle, padding: "0.62rem 0.55rem", fontSize: "0.78rem" }} />
                  {categoryRows.length > 1 && <button type="button" aria-label={`Remove ${categoryLabel(category)} row`} onClick={() => removeRow(row.id)} style={{ border: 0, background: "transparent", color: colors.danger, cursor: "pointer", padding: "0.4rem" }}><X size={15} /></button>}
                </div>
                {(short || disabledItem) && <span style={{ color: colors.danger, fontSize: "0.7rem", fontWeight: 500 }}>{disabledItem ? `${item.name} is disabled and cannot be stocked out. Remove it or pick another item.` : `Only ${item.quantity} ${item.unit} in stock.`}</span>}
                {category === "CHEMICAL" && row.itemId && <input
                  aria-label="Batch or lot number"
                  value={row.batchNumber || ""}
                  onChange={(event) => updateRow(row.id, "batchNumber", event.target.value)}
                  placeholder="Batch / lot no. from the container — e.g. L24-0917"
                  maxLength={LIMITS.SHORT_TEXT_MAX}
                  style={{ ...inputStyle, padding: "0.5rem 0.55rem", fontSize: "0.74rem" }}
                />}
                </div>
              );
            })}
            {categoryItems.length === 0 && <span style={{ color: colors.muted, fontSize: "0.72rem" }}>No active {categoryLabel(category).toLowerCase()} inventory items.</span>}
          </section>
        );
      })}
      {formError && <p role="alert" style={{ margin: 0, color: colors.danger, fontSize: "0.8rem", fontWeight: 500 }}>{formError}</p>}
      <button type="submit" disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}><PackageCheck size={15} /> {saving ? "Recording…" : "Record stock out"}</button>
      {(appointment.stockUsed || []).length > 0 && <div style={{ display: "grid", gap: "0.45rem" }}><strong style={{ fontSize: "0.76rem", color: colors.muted }}>Recorded for this service</strong>{appointment.stockUsed.map((entry, index) => <div key={`${entry.itemId}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.55rem 0.7rem", border: "1px solid #efe9e0", borderRadius: "3.75px", fontSize: "0.78rem" }}><span>{entry.name}{entry.date && <span style={{ color: colors.muted, marginLeft: "0.4rem" }}>· {new Date(`${entry.date}T00:00:00`).toLocaleDateString()}</span>}</span><strong>{entry.amount} {entry.unit}</strong></div>)}</div>}
    </form>
  );
}

function InfoRow({ icon, label, value }) {
  return <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", paddingBottom: "0.85rem", borderBottom: "1px solid #f1e7e7" }}><span style={{ color: colors.brand, marginTop: "0.1rem" }}>{icon}</span><div><div style={{ color: colors.muted, fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase" }}>{label}</div><div style={{ color: colors.ink, fontSize: "0.84rem", marginTop: "0.18rem", lineHeight: 1.45 }}>{value}</div></div></div>;
}

export default SchedulingPage;
