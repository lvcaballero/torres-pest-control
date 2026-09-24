import { useMemo } from "react";
import { useServicesContext } from "../context/ServicesContext";

// Adds the lookups every consumer needs: the booking form lists only active
// services, while an existing appointment must still resolve a retired one.
export default function useServices() {
  const context = useServicesContext();
  const { services } = context;

  return useMemo(() => {
    const byId = new Map(services.map((service) => [service.id, service]));
    return {
      ...context,
      activeServices: services.filter((service) => service.isActive),
      serviceById: (id) => (id ? byId.get(id) || null : null),
      serviceByName: (name) => {
        const key = String(name || "").trim().toLowerCase();
        return key ? services.find((service) => service.name.trim().toLowerCase() === key) || null : null;
      },
    };
  }, [context, services]);
}
