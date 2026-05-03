import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { crmServices } from "@/lib/dashboard-services";

export default function CrmPage() {
  return (
    <ServiceSectionPage
      title="CRM"
      subtitle="Salesforce, HubSpot, Airtable, and Pipedrive automations"
      services={crmServices}
    />
  );
}
