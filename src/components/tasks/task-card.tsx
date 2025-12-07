"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Task } from "@/types/task";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { useSlideover } from "@/components/slideover/slideover-provider";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onUpdate?: (task: Task) => void;
}

const statusColors = {
  inbox: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  available: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
};

const priorityColors = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
};

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const { selectItem } = useSlideover();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCheckboxChange = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: checked ? "completed" : "inbox"
        }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        onUpdate?.(updatedTask);
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCardClick = () => {
    selectItem(task.id);
  };

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer hover:bg-accent/50 transition-colors",
        isUpdating && "opacity-50"
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.status === "completed"}
          onCheckedChange={handleCheckboxChange}
          disabled={isUpdating}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />

        <div className="flex-1 min-w-0 space-y-2">
          <h3 className={cn(
            "font-medium text-sm",
            task.status === "completed" && "line-through text-muted-foreground"
          )}>
            {task.title}
          </h3>

          <div className="flex flex-wrap gap-2 items-center">
            <Badge className={statusColors[task.status]}>
              {task.status}
            </Badge>

            <Badge className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>

            {task.dueDate && (
              <span className="text-xs text-muted-foreground">
                Due: {format(new Date(task.dueDate), "MMM d")}
              </span>
            )}

            {task.projectName && (
              <span className="text-xs text-muted-foreground">
                {task.projectName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
