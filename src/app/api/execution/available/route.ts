/**
 * Execution API - Available Tasks
 * Get tasks that are available to work on
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, getProject } from '@/graph/operations';
import { calculateTaskAvailability } from '@/execution';
import type { Task } from '@/domain';

export const maxDuration = 10;

// ============================================================================
// GET /api/execution/available - Get available tasks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const filterProjectId = searchParams.get('projectId');

    const now = new Date();

    // Get all tasks using operations layer (handles mapping)
    const allTasks = await getAllTasks(limit * 3);

    // Filter to non-completed, non-deferred tasks
    const eligibleTasks = allTasks.filter((task) => {
      // Status filter
      if (!['inbox', 'available', 'blocked'].includes(task.status)) {
        return false;
      }

      // Defer date filter
      if (task.deferDate && new Date(task.deferDate) > now) {
        return false;
      }

      // Project filter
      if (filterProjectId && task.projectId !== filterProjectId) {
        return false;
      }

      return true;
    });

    // Calculate availability for each task
    const availableTasks: Task[] = [];

    // Cache projects
    const projectCache = new Map<string, Awaited<ReturnType<typeof getProject>>>();

    for (const task of eligibleTasks) {
      // Get project
      let project = null;
      if (task.projectId) {
        if (!projectCache.has(task.projectId)) {
          projectCache.set(task.projectId, await getProject(task.projectId));
        }
        project = projectCache.get(task.projectId)!;
      }

      // Get incomplete dependencies
      const incompleteDeps = eligibleTasks
        .filter(
          (t) =>
            task.dependencies?.includes(t.id) &&
            t.status !== 'completed'
        )
        .map((t) => t.id);

      // Check if first in sequential project
      const projectTasks = eligibleTasks.filter((t) => t.projectId === task.projectId);
      const isFirstInSequential =
        project?.type === 'sequential' &&
        !projectTasks.some(
          (t) =>
            t.id !== task.id &&
            t.status !== 'completed' &&
            new Date(t.createdAt) < new Date(task.createdAt)
        );

      const availability = await calculateTaskAvailability(
        task,
        project,
        incompleteDeps,
        isFirstInSequential
      );

      if (availability === 'available') {
        availableTasks.push(task);
      }

      if (availableTasks.length >= limit) {
        break;
      }
    }

    return NextResponse.json({
      tasks: availableTasks,
      count: availableTasks.length,
    });
  } catch (error) {
    console.error('GET /api/execution/available error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available tasks' },
      { status: 500 }
    );
  }
}
