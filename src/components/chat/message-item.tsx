import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function MessageItem({ role, content }: MessageItemProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <p className="text-sm italic text-zinc-500">{content}</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex w-full py-2",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-lg px-4 py-2",
        isUser
          ? "bg-blue-500 text-white"
          : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
