"use client";

import { useEffect, useState } from "react";
import { Insight } from "@/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Lightbulb, Heart, TrendingUp, BookOpen, Calendar, Clock } from "lucide-react";

const typeColors = {
  preference: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
  theme: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  stable_fact: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  commitment: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  recurring_constraint: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
};

const typeIcons = {
  preference: Heart,
  theme: TrendingUp,
  stable_fact: BookOpen,
  commitment: Calendar,
  recurring_constraint: Clock,
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            confidence >= 0.8 ? "bg-green-500" :
            confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
          )}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  );
}

export function InsightList() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/insights");
      if (!response.ok) {
        throw new Error("Failed to fetch insights");
      }

      const data = await response.json();
      // Sort by confidence descending
      const sorted = (data.insights || []).sort(
        (a: Insight, b: Insight) => b.confidence - a.confidence
      );
      setInsights(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching insights:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      fetchInsights();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading insights...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        Error: {error}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
        <Lightbulb className="h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">No insights yet</p>
        <p className="text-sm text-center">
          Insights are discovered automatically as you use POF
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {insights.map((insight) => {
          const TypeIcon = typeIcons[insight.type] || Lightbulb;
          return (
            <Card
              key={insight.id}
              className={cn("p-3 hover:bg-accent/50 transition-colors")}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-md bg-muted">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm">{insight.content}</p>

                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <Badge className={typeColors[insight.type]}>
                      {insight.type.replace("_", " ")}
                    </Badge>

                    <ConfidenceBar confidence={insight.confidence} />
                  </div>

                  {insight.reinforcementCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Reinforced {insight.reinforcementCount} time{insight.reinforcementCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
