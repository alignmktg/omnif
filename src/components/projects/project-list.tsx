"use client";

import { useEffect, useState } from "react";
import { Project } from "@/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FolderKanban, ArrowRight, Layers } from "lucide-react";

const statusColors = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  on_hold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  dropped: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
};

const typeIcons = {
  parallel: Layers,
  sequential: ArrowRight,
};

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/projects?status=active");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      fetchProjects();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading projects...
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

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
        <FolderKanban className="h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">No projects yet</p>
        <p className="text-sm">Create a project to organize related tasks</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {projects.map((project) => {
          const TypeIcon = typeIcons[project.type] || FolderKanban;
          return (
            <Card
              key={project.id}
              className={cn("p-3 cursor-pointer hover:bg-accent/50 transition-colors")}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-md bg-muted">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <h3 className="font-medium text-sm">{project.name}</h3>

                  {project.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {project.notes}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge className={statusColors[project.status]}>
                      {project.status.replace("_", " ")}
                    </Badge>

                    <Badge variant="outline" className="text-xs">
                      {project.type}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
