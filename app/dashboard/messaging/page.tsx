import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { messagingServices } from "@/lib/dashboard-services";

export default function MessagingPage() {
  return (
    <ServiceSectionPage
      title="Messaging"
      subtitle="Telegram, WhatsApp, Slack, and Discord automations"
      services={messagingServices}
    />
  );
}
