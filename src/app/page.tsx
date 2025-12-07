'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/chat');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          POF - Productivity Orchestration Framework
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Redirecting to chat...
        </p>
      </div>
    </div>
  );
}
