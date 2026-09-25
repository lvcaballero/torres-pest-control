// The current time, refreshed every `intervalMs` — for anything drawn
// against the clock (the calendar's now line, "on site" states).

import { useEffect, useState } from "react";

export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
