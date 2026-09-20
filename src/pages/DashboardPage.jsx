// Dashboard route.
//
// Two dashboards, not three. A technician's appointment reads are scoped by the
// database (migration 030), so they need their own view — the shared one was
// counting their jobs and labelling the figure "All records in system". Admin
// and staff share the office view, which gates its few admin-only panels inline
// rather than duplicating the whole file.

import OfficeDashboard from "../components/dashboard/OfficeDashboard";
import TechnicianDashboard from "../components/dashboard/TechnicianDashboard";
import useAuth from "../hooks/useAuth";
import { ROLES } from "../utils/constants";

function DashboardPage() {
  const { currentUser } = useAuth();

  if (currentUser?.role === ROLES.TECHNICIAN) return <TechnicianDashboard />;
  return <OfficeDashboard />;
}

export default DashboardPage;
