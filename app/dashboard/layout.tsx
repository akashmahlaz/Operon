import { auth } from "@/auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import type { ConversationSummary } from "@/lib/types";

// Stubbed conversations for now — wire to Mongo via /api/conversations next.
const stubConversations: ConversationSummary[] = [
  {
    id: "demo-1",
    title: "Launch plan for v2",
    channel: "web",
    preview: "Drafted the X + LinkedIn series…",
    messageCount: 12,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "WhatsApp triage bot",
    channel: "whatsapp",
    preview: "Connected new number, listening…",
    messageCount: 4,
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={stubConversations}
        user={
          session?.user
            ? {
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }
            : undefined
        }
      />
      <SidebarInset className="flex min-h-svh flex-col">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
