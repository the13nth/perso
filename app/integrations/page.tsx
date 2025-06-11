"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

const integrations = [
  {
    name: "Gmail",
    description: "Connect your Gmail account to analyze email patterns, communication trends, and get insights from your email history.",
    icon: Mail,
    href: "/integrations/gmail"
  },
  {
    name: "Calendar",
    description: "Connect your Google Calendar to manage events, track meeting patterns, and analyze your schedule and time allocation.",
    icon: Calendar,
    href: "/integrations/calendar"
  }
];

export default function IntegrationsPage() {
  const router = useRouter();

  return (
    <div className="container py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Available Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your accounts to enhance your experience with additional features and insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          
          return (
            <Card key={integration.name} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-6 w-6" />
                  {integration.name}
                </CardTitle>
                <CardDescription>{integration.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full"
                  onClick={() => router.push(integration.href)}
                >
                  Configure
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 