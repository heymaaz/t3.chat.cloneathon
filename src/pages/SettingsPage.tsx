import { useQuery } from "convex/react";
import { api } from "@backend/_generated/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { Loader2, ArrowLeft, Settings, Key, Shield } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SignOutButton } from "@/SignOutButton";
import { ThemeToggleButton } from "@/components/Theme/ThemeToggleButton";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { DangerZone } from "@/components/settings/DangerZone";

export default function SettingsPage() {
  const [tab, setTab] = useState("api-keys");
  const navigate = useNavigate();
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card sticky top-0 z-40">
        <Button
          variant="ghost"
          onClick={() => void navigate({ to: "/" })}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Chat
        </Button>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <SignOutButton />
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Settings className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your API keys and account preferences
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex gap-2 mb-6">
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="danger-zone" className="gap-2">
              <Shield className="h-4 w-4" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <ApiKeySection />
          </TabsContent>

          {/* Danger Zone Tab */}
          <TabsContent value="danger-zone" className="space-y-6">
            <DangerZone />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
