import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { microsoftServices } from "@/lib/dashboard-services";

export default function MicrosoftPage() {
  return (
    <ServiceSectionPage
      title="Microsoft"
      subtitle="Outlook, Teams, OneDrive, and Azure automations"
      services={microsoftServices}
    />
  );
}
