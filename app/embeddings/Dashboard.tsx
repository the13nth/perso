"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StorageDocuments from "./StorageDocuments";
import EmbeddingMetadata from "./EmbeddingMetadata";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("metadata");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4 sm:mt-6">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-50 bg-background h-11 sm:h-12">
            <TabsTrigger value="metadata" className="text-sm sm:text-base">Metadata</TabsTrigger>
            <TabsTrigger value="storage" className="text-sm sm:text-base">Storage</TabsTrigger>
          </TabsList>

          <TabsContent value="metadata" className="space-y-4 sm:space-y-6">
            <EmbeddingMetadata />
          </TabsContent>

          <TabsContent value="storage" className="space-y-4 sm:space-y-6">
            <StorageDocuments />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
