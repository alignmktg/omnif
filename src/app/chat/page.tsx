'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import ChatContainer from '@/components/chat/chat-container';
import MessageList from '@/components/chat/message-list';
import ChatInput from '@/components/chat/chat-input';
import { useSlideover } from '@/components/slideover';
import { FAB } from '@/components/ui/fab';
import { ListTodo } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasGreeted = useRef(false);
  const slideover = useSlideover();

  // Send a message (reusable for user input and auto-greet)
  const sendMessage = useCallback(async (messageContent: string, showInChat = true) => {
    if (isLoading) return;

    // Add user message to chat (unless it's auto-greet)
    if (showInChat) {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageContent,
      };
      setMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/concierge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageContent, sessionId }),
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
      setIsInitialLoad(false);
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
  }, [isLoading, sessionId]);

  // Initialize session
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

  // Auto-greet on page load (after session is set)
  useEffect(() => {
    if (sessionId && !hasGreeted.current) {
      hasGreeted.current = true;
      sendMessage('[AUTO_GREET]', false);
    }
  }, [sessionId, sendMessage]);

  // Keyboard shortcut for tasks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        slideover.open('inbox');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slideover]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message, true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  return (
    <>
      <ChatContainer>
        <MessageList messages={messages} isLoading={isLoading} isInitialLoad={isInitialLoad} />
        <ChatInput
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          disabled={isLoading}
        />
      </ChatContainer>
      <FAB
        onClick={() => slideover.open('inbox')}
        icon={ListTodo}
        label="Open tasks"
      />
    </>
  );
}
