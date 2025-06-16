"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const integrations = [
  {
    name: "Gmail",
    description: "Connect your Gmail account to analyze email patterns, communication trends, and get insights from your email history.",
    icon: Mail,
    href: "/integrations/gmail",
    status: "Not Connected" as const
  },
  {
    name: "Calendar",
    description: "Connect your Google Calendar to manage events, track meeting patterns, and analyze your schedule and time allocation.",
    icon: Calendar,
    href: "/integrations/calendar",
    status: "Not Connected" as const
  }
];

export default function IntegrationsPage() {
  const router = useRouter();

  return (
    <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Available Integrations
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Connect your accounts to enhance your experience with additional features and insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          
          return (
            <Card 
              key={integration.name} 
              className={cn(
                "group relative flex flex-col",
                "hover:shadow-md transition-all duration-200",
                "border-border/60 hover:border-primary/60"
              )}
            >
              <CardHeader className="space-y-3 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <div className="p-1.5 sm:p-2 bg-primary/10 rounded-md">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    {integration.name}
                  </CardTitle>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {integration.status}
                  </span>
                </div>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  {integration.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 mt-auto">
                <Button 
                  className="w-full group-hover:bg-primary/90 transition-colors"
                  onClick={() => router.push(integration.href)}
                >
                  Configure Integration
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 