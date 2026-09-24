// Services route — the service catalog and each service's default materials
// (migration 047). Sits under Operations beside Treatment Methods: services
// are WHAT is sold and what it uses, treatment methods are HOW it was applied.

import PageHeader from "../components/common/PageHeader";
import ServiceProfilesAdmin from "../components/services/ServiceProfilesAdmin";
import { pageShell } from "../styles/theme";

function ServicesPage() {
  return (
    <div style={pageShell}>
      <PageHeader eyebrow="Operations" title="Services" />
      <ServiceProfilesAdmin />
    </div>
  );
}

export default ServicesPage;
