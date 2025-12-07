import { Badge } from '@/components/ui/badge';
import type { InteractionMode } from '@/concierge/modes';

interface ChatContainerProps {
  children: React.ReactNode;
  mode?: InteractionMode;
}

export default function ChatContainer({ children, mode }: ChatContainerProps) {
  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b bg-white p-4 dark:bg-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-semibold">POF Concierge</h1>
          {mode && (
            <Badge variant="outline">
              {mode.replace('_', ' ')}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto flex flex-1 w-full max-w-3xl flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
