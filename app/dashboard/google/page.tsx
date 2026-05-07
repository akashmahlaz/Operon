import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { googleServices } from "@/lib/dashboard-services";

export default function GooglePage() {
  return (
    <ServiceSectionPage
      title="Google"
      subtitle="Gmail, Calendar, Meet, YouTube, and workspace automations"
      services={googleServices}
    />
  );
}