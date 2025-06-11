"use client";

import { Mail, ArrowLeft, Calendar } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const integrations = [
  {
    name: "Gmail",
    description: "Connect your Gmail account for email analysis",
    icon: Mail,
    href: "/integrations/gmail"
  },
  {
    name: "Calendar",
    description: "Connect your Google Calendar for schedule management",
    icon: Calendar,
    href: "/integrations/calendar"
  }
];

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = pathname === "/integrations";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            {!isRoot && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/integrations")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-lg font-semibold">Integrations</h2>
          </div>
        </div>
        <nav className="p-2">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            const isActive = pathname === integration.href;
            
            return (
              <Button
                key={integration.name}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start gap-2 mb-1"
                onClick={() => router.push(integration.href)}
              >
                <Icon className="h-4 w-4" />
                {integration.name}
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
} 