interface ChatContainerProps {
  children: React.ReactNode;
}

export default function ChatContainer({ children }: ChatContainerProps) {
  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-zinc-900">
      <header className="flex-none border-b bg-white p-3 sm:p-4 dark:bg-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg sm:text-xl font-semibold">POF Concierge</h1>
        </div>
      </header>

      <main className="mx-auto flex flex-1 w-full max-w-3xl flex-col overflow-hidden min-h-0">
        {children}
      </main>
    </div>
  );
}
