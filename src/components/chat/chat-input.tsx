'use client';

import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled: boolean;
}

export default function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    }
  };

  return (
    <form onSubmit={onSubmit} className="border-t bg-white p-4 dark:bg-zinc-800">
      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message..."
          className="flex-1 resize-none rounded-md border bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
          rows={1}
        />
        <Button type="submit" disabled={disabled || !value.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
