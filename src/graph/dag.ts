/**
 * DAG Invariant Enforcement
 * Cycle detection and dependency validation
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from './schema';
import type { Task } from '@/domain/types';

/**
 * Result of DAG validation
 */
export interface DAGValidationResult {
  valid: boolean;
  error?: string;
  cycle?: string[];
}

/**
 * Build adjacency list from task dependencies
 */
function buildDependencyGraph(
  taskList: Array<{ id: string; dependencies: string[] }>
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const task of taskList) {
    if (!graph.has(task.id)) {
      graph.set(task.id, new Set());
    }
    for (const dep of task.dependencies) {
      graph.get(task.id)!.add(dep);
    }
  }

  return graph;
}

/**
 * Detect cycle using DFS with color marking
 * WHITE (0) = unvisited, GRAY (1) = in progress, BLACK (2) = completed
 */
function detectCycle(
  graph: Map<string, Set<string>>,
  start: string
): { hasCycle: boolean; cycle?: string[] } {
  const color = new Map<string, number>();
  const parent = new Map<string, string>();
  const allNodes = new Set(graph.keys());

  // Add all dependency targets as nodes
  for (const deps of graph.values()) {
    for (const dep of deps) {
      allNodes.add(dep);
    }
  }

  for (const node of allNodes) {
    color.set(node, 0); // WHITE
  }

  const dfs = (node: string): { hasCycle: boolean; cycle?: string[] } => {
    color.set(node, 1); // GRAY - in progress

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (color.get(neighbor) === 1) {
        // Found cycle - reconstruct path
        const cycle: string[] = [neighbor];
        let current = node;
        while (current !== neighbor) {
          cycle.unshift(current);
          current = parent.get(current) || neighbor;
        }
        cycle.unshift(neighbor);
        return { hasCycle: true, cycle };
      }

      if (color.get(neighbor) === 0) {
        parent.set(neighbor, node);
        const result = dfs(neighbor);
        if (result.hasCycle) return result;
      }
    }

    color.set(node, 2); // BLACK - completed
    return { hasCycle: false };
  };

  return dfs(start);
}

/**
 * Check if adding a dependency would create a cycle
 */
export async function wouldCreateCycle(
  taskId: string,
  newDependencyId: string
): Promise<DAGValidationResult> {
  // Can't depend on self
  if (taskId === newDependencyId) {
    return {
      valid: false,
      error: 'Task cannot depend on itself',
      cycle: [taskId, taskId],
    };
  }

  // Fetch all tasks to build dependency graph
  const allTasks = await db
    .select({
      id: tasks.id,
      dependencies: tasks.dependencies,
    })
    .from(tasks);

  // Create a hypothetical graph with the new dependency added
  const taskMap = new Map(allTasks.map((t) => [t.id, { ...t }]));

  // Ensure the task exists
  if (!taskMap.has(taskId)) {
    // New task - just check if dependency exists
    if (!taskMap.has(newDependencyId)) {
      return {
        valid: false,
        error: `Dependency task ${newDependencyId} does not exist`,
      };
    }
    return { valid: true };
  }

  // Add the new dependency
  const currentTask = taskMap.get(taskId)!;
  const updatedDeps = [...currentTask.dependencies, newDependencyId];
  taskMap.set(taskId, { ...currentTask, dependencies: updatedDeps });

  // Build graph and check for cycles
  const graph = buildDependencyGraph(Array.from(taskMap.values()));
  const result = detectCycle(graph, taskId);

  if (result.hasCycle) {
    return {
      valid: false,
      error: `Adding dependency would create cycle: ${result.cycle!.join(' -> ')}`,
      cycle: result.cycle,
    };
  }

  return { valid: true };
}

/**
 * Validate all dependencies for a task
 */
export async function validateDependencies(
  taskId: string,
  dependencies: string[]
): Promise<DAGValidationResult> {
  // Check for self-reference
  if (dependencies.includes(taskId)) {
    return {
      valid: false,
      error: 'Task cannot depend on itself',
      cycle: [taskId, taskId],
    };
  }

  // Check for duplicates
  const uniqueDeps = new Set(dependencies);
  if (uniqueDeps.size !== dependencies.length) {
    return {
      valid: false,
      error: 'Duplicate dependencies not allowed',
    };
  }

  // Verify all dependencies exist
  if (dependencies.length > 0) {
    const existingTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.id, dependencies));

    const existingIds = new Set(existingTasks.map((t) => t.id));
    const missingDeps = dependencies.filter((d) => !existingIds.has(d));

    if (missingDeps.length > 0) {
      return {
        valid: false,
        error: `Dependencies do not exist: ${missingDeps.join(', ')}`,
      };
    }
  }

  // Fetch all tasks to build dependency graph
  const allTasks = await db
    .select({
      id: tasks.id,
      dependencies: tasks.dependencies,
    })
    .from(tasks);

  // Create hypothetical graph
  const taskMap = new Map(allTasks.map((t) => [t.id, { ...t }]));
  taskMap.set(taskId, { id: taskId, dependencies });

  // Build graph and check for cycles starting from modified task
  const graph = buildDependencyGraph(Array.from(taskMap.values()));
  const result = detectCycle(graph, taskId);

  if (result.hasCycle) {
    return {
      valid: false,
      error: `Dependencies would create cycle: ${result.cycle!.join(' -> ')}`,
      cycle: result.cycle,
    };
  }

  return { valid: true };
}

/**
 * Validate date constraints
 */
export function validateDateConstraints(
  deferDate: string | null,
  dueDate: string | null
): DAGValidationResult {
  if (deferDate && dueDate) {
    const defer = new Date(deferDate);
    const due = new Date(dueDate);

    if (due < defer) {
      return {
        valid: false,
        error: 'Due date must be >= defer date',
      };
    }
  }

  return { valid: true };
}

/**
 * Get all tasks that depend on a given task (reverse dependencies)
 */
export async function getDependentTasks(taskId: string): Promise<string[]> {
  const allTasks = await db
    .select({
      id: tasks.id,
      dependencies: tasks.dependencies,
    })
    .from(tasks);

  return allTasks.filter((t) => t.dependencies.includes(taskId)).map((t) => t.id);
}

/**
 * Get all tasks in dependency chain (transitive dependencies)
 */
export async function getTransitiveDependencies(taskId: string): Promise<string[]> {
  const allTasks = await db
    .select({
      id: tasks.id,
      dependencies: tasks.dependencies,
    })
    .from(tasks);

  const taskMap = new Map(allTasks.map((t) => [t.id, t.dependencies]));
  const visited = new Set<string>();
  const result: string[] = [];

  const traverse = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);

    const deps = taskMap.get(id) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        result.push(dep);
        traverse(dep);
      }
    }
  };

  traverse(taskId);
  return result;
}

/**
 * Check if all dependencies of a task are completed
 */
export async function areDependenciesComplete(taskId: string): Promise<boolean> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task || task.dependencies.length === 0) {
    return true;
  }

  const depTasks = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(inArray(tasks.id, task.dependencies));

  return depTasks.every((t) => t.status === 'completed');
}
