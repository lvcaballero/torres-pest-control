// Hook for fetching treatment methods from the database.
//
// Replaces the old hardcoded TREATMENT_METHODS / TREATMENT_METHOD_GROUPS
// from constants.js.  The data shape stays the same so existing components
// can swap in with minimal changes.

import { useCallback, useEffect, useState } from "react";
import { fetchTreatmentMethods } from "../services/settingsService";

export default function useTreatmentMethods() {
  const [methods, setMethods] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchTreatmentMethods();
    if (result.error) {
      setError(result.error);
    } else {
      // Map to the shape the rest of the app expects:
      //   { group: "Application", value: "GEL_BAIT", label: "Gel bait application" }
      const mapped = (result.methods || []).map((row) => ({
        group: row.group_name,
        value: row.value,
        label: row.label,
      }));
      setMethods(mapped);
      // Unique ordered group names.
      const uniqueGroups = [...new Set(mapped.map((m) => m.group))];
      setGroups(uniqueGroups);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { methods, groups, loading, error, reload: load };
}

