'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import MessageItem from './message-item';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-zinc-500">Send a message to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              role={message.role}
              content={message.content}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start py-2">
              <div className="rounded-lg bg-zinc-100 px-4 py-2 dark:bg-zinc-800">
                <div className="flex space-x-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.2s]" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}
