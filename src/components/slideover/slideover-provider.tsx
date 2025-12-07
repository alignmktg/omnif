"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type SlideoverTab = "inbox" | "available" | "scheduled" | "projects" | "insights";

interface SlideoverContextType {
  isOpen: boolean;
  activeTab: SlideoverTab;
  selectedItemId: string | null;
  open: (tab?: SlideoverTab) => void;
  close: () => void;
  setTab: (tab: SlideoverTab) => void;
  selectItem: (id: string | null) => void;
}

const SlideoverContext = createContext<SlideoverContextType | undefined>(undefined);

interface SlideoverProviderProps {
  children: ReactNode;
}

export function SlideoverProvider({ children }: SlideoverProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SlideoverTab>("inbox");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const open = (tab?: SlideoverTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);
  const setTab = (tab: SlideoverTab) => setActiveTab(tab);
  const selectItem = (id: string | null) => setSelectedItemId(id);

  return (
    <SlideoverContext.Provider
      value={{
        isOpen,
        activeTab,
        selectedItemId,
        open,
        close,
        setTab,
        selectItem,
      }}
    >
      {children}
    </SlideoverContext.Provider>
  );
}

export function useSlideover() {
  const context = useContext(SlideoverContext);
  if (context === undefined) {
    throw new Error("useSlideover must be used within a SlideoverProvider");
  }
  return context;
}
