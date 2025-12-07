export type TaskStatus = "inbox" | "available" | "scheduled" | "blocked" | "completed";
export type TaskPriority = "critical" | "high" | "normal" | "low";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO 8601 date string
  projectId?: string;
  projectName?: string; // Denormalized for display
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string;
}
