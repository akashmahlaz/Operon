import { Suspense } from "react";
import { ProvidersSettings } from "@/components/dashboard/settings/providers-settings";

export default function ProvidersSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ProvidersSettings />
    </Suspense>
  );
}
