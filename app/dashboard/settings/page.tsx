import { PageShell } from "@/components/dashboard/page-shell";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const session = await auth();
  return (
    <PageShell title="Settings" subtitle="Workspace, persona and providers">
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear to Brilion.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue={session?.user?.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={session?.user?.email ?? ""} disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Persona</CardTitle>
            <CardDescription>The system prompt prepended to every conversation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              defaultValue={`You are Brilion, the user's personal AI operating system. Be concise, proactive, and prefer running tools to asking for clarification.`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI provider</CardTitle>
            <CardDescription>Models used for chat and tool execution.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="model">Default model</Label>
              <Input id="model" defaultValue="MiniMax-M2.7" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">API key</Label>
              <Input id="key" type="password" placeholder="sk-…" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="rounded-full">Save changes</Button>
        </div>
      </div>
    </PageShell>
  );
}
