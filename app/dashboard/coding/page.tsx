import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { codingServices } from "@/lib/dashboard-services";

export default function CodingPage() {
  return (
    <ServiceSectionPage
      title="Coding"
      subtitle="Developer tools for repositories, deployments, and edge infrastructure"
      services={codingServices}
    />
  );
}