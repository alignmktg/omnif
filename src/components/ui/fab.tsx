import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}

export function FAB({ onClick, icon: Icon, label }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-6 right-6 md:bottom-6 md:right-6 sm:bottom-20 rounded-full bg-primary text-primary-foreground p-4 shadow-lg hover:shadow-xl transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
