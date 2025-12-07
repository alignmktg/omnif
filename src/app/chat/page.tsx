'use client';

import { useEffect, useState, useRef } from 'react';
import ChatContainer from '@/components/chat/chat-container';
import MessageList from '@/components/chat/message-list';
import ChatInput from '@/components/chat/chat-input';
import SuggestionChips from '@/components/chat/suggestion-chips';
import type { InteractionMode } from '@/concierge/modes';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [currentMode, setCurrentMode] = useState<InteractionMode>('chief_of_staff');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pof_session_id');
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = `session_${Date.now()}`;
      setSessionId(newId);
      localStorage.setItem('pof_session_id', newId);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/concierge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'No response',
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.mode) {
        setCurrentMode(data.mode);
      }
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <ChatContainer mode={currentMode}>
      <MessageList messages={messages} isLoading={isLoading} />
      <SuggestionChips
        suggestions={suggestions}
        onSuggestionClick={handleSuggestionClick}
      />
      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        disabled={isLoading}
      />
    </ChatContainer>
  );
}
