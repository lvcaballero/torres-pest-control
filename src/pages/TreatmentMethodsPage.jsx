// Treatment methods route — the admin-managed list of choices technicians tick
// under "Treatment performed" on a service report.
//
// Reached from its own sidebar entry below Scheduling rather than from a
// Settings page: the list is operational data the office edits, not an
// application preference, and SettingsPage was never wired to a route.

import PageHeader from "../components/common/PageHeader";
import TreatmentMethodsAdmin from "../components/settings/TreatmentMethodsAdmin";
import { pageShell } from "../styles/theme";

function TreatmentMethodsPage() {
  return (
    <div style={pageShell}>
      <PageHeader eyebrow="Operations" title="Treatment Methods" />
      <TreatmentMethodsAdmin />
    </div>
  );
}

export default TreatmentMethodsPage;
