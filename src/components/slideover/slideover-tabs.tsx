"use client";

import React from "react";
import { useSlideover, SlideoverTab } from "./slideover-provider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function SlideoverTabs() {
  const { activeTab, setTab } = useSlideover();

  const handleTabChange = (value: string) => {
    setTab(value as SlideoverTab);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full flex-col"
    >
      <div className="border-b px-6 pt-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="inbox" className="flex-1">
            Inbox
          </TabsTrigger>
          <TabsTrigger value="available" className="flex-1">
            Available
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex-1">
            Scheduled
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex-1">
            Projects
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex-1">
            Insights
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto">
        <TabsContent value="inbox" className="m-0 h-full p-6">
          <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
            Inbox tasks will appear here
          </div>
        </TabsContent>

        <TabsContent value="available" className="m-0 h-full p-6">
          <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
            Available tasks will appear here
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="m-0 h-full p-6">
          <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
            Scheduled tasks will appear here
          </div>
        </TabsContent>

        <TabsContent value="projects" className="m-0 h-full p-6">
          <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
            Projects will appear here
          </div>
        </TabsContent>

        <TabsContent value="insights" className="m-0 h-full p-6">
          <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
            Insights will appear here
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}
