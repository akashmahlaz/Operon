import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { projectsServices } from "@/lib/dashboard-services";

export default function ProjectsPage() {
  return (
    <ServiceSectionPage
      title="Projects"
      subtitle="Notion, Linear, Jira, and Asana automations"
      services={projectsServices}
    />
  );
}
