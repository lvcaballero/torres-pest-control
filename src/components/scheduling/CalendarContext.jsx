// Shared state for everything drawn inside the calendar.
//
// AppointmentCard sits two levels below the page (page -> WeekGrid -> day
// layer -> card) and is rendered from three places: the week grid, the month
// grid, and the overflow dialog. Threading clients, accounts, colours,
// selection, drag state and five callbacks through two intermediate
// components is the prop drill worth removing.
//
// This is the ONLY context in the scheduling tree. The detail panel
// deliberately does not use one: its props are almost all callbacks, so a
// provider would add a layer without removing a single argument.

import { createContext, useContext } from "react";

const CalendarContext = createContext(null);

export function CalendarProvider({ value, children }) {
  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const value = useContext(CalendarContext);
  if (!value) throw new Error("useCalendar must be used inside a CalendarProvider");
  return value;
}

export default CalendarContext;
