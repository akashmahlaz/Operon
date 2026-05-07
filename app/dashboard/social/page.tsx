import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { socialServices } from "@/lib/dashboard-services";

export default function SocialPage() {
  return (
    <ServiceSectionPage
      title="Social"
      subtitle="Plan, publish, and monitor campaigns across social channels"
      services={socialServices}
    />
  );
}