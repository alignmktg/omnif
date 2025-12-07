import { Badge } from '@/components/ui/badge';

interface SuggestionChipsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}

export default function SuggestionChips({ suggestions, onSuggestionClick }: SuggestionChipsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="border-t bg-white p-2 dark:bg-zinc-800">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {suggestions.map((suggestion, idx) => (
          <Badge
            key={idx}
            variant="secondary"
            className="cursor-pointer whitespace-nowrap hover:bg-zinc-300 dark:hover:bg-zinc-600"
            onClick={() => onSuggestionClick(suggestion)}
          >
            {suggestion}
          </Badge>
        ))}
      </div>
    </div>
  );
}
