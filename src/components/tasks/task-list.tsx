"use client";

import { useEffect, useState } from "react";
import { Task, TaskStatus } from "@/types/task";
import { TaskCard } from "./task-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TaskListProps {
  filter: TaskStatus | "all";
}

const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Sort by priority first
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date (earliest first, undefined last)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Finally by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function TaskList({ filter }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.set("filter", filter);
      }

      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }

      const data = await response.json();
      setTasks(sortTasks(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching tasks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchTasks();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [filter]);

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prevTasks => {
      const newTasks = prevTasks.map(t =>
        t.id === updatedTask.id ? updatedTask : t
      );
      return sortTasks(newTasks);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading tasks...
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

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
        <p className="text-lg font-medium">No tasks found</p>
        <p className="text-sm">
          {filter === "all"
            ? "Create a task to get started"
            : `No ${filter} tasks at the moment`
          }
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onUpdate={handleTaskUpdate}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
