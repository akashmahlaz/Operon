import { ServiceSectionPage } from "@/components/dashboard/service-section-page";
import { tradingServices } from "@/lib/dashboard-services";

export default function TradingPage() {
  return (
    <ServiceSectionPage
      title="Trading"
      subtitle="Portfolio workflows, market summaries, and broker integrations"
      services={tradingServices}
    />
  );
}