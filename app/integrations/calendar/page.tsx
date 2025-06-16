'use client';

import { useUser } from "@clerk/nextjs";
import CalendarConnect from "@/app/components/integrations/calendar/CalendarConnect";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CalendarIntegrationPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <div className="rounded-lg border border-gray-800 bg-[#1a1c2e] p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-white">Sign In Required</h2>
          <p className="text-gray-400">
            Please sign in to access calendar integration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      <div>
        <Link 
          href="/integrations"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to integrations
        </Link>
        <h1 className="text-2xl font-bold text-white">Calendar Integration</h1>
        <p className="text-gray-400 mt-2">Connect your Google Calendar to enable calendar analysis and insights.</p>
      </div>
      <div className="max-w-2xl">
        <CalendarConnect />
      </div>
    </div>
  );
} 