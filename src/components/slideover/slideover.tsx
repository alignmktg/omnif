"use client";

import React from "react";
import { useSlideover } from "./slideover-provider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SlideoverTabs } from "./slideover-tabs";

export function Slideover() {
  const { isOpen, close, activeTab } = useSlideover();

  // Determine header title based on active tab
  const getHeaderTitle = () => {
    switch (activeTab) {
      case "projects":
        return "Projects";
      case "insights":
        return "Insights";
      default:
        return "Tasks";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="w-[90vw] max-w-[400px] sm:max-w-md md:max-w-lg p-0"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{getHeaderTitle()}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <SlideoverTabs />
        </div>
      </SheetContent>
    </Sheet>
  );
}
