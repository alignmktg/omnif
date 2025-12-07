/**
 * Execution API - Forecast
 * Get tasks organized by due date (OmniFocus Forecast view)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks } from '@/graph/operations';
import type { Task } from '@/domain';

export const maxDuration = 10;

// ============================================================================
// GET /api/execution/forecast - Get forecast view
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '14', 10);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    endDate.setHours(23, 59, 59, 999);

    // Get all tasks using operations layer
    const allTasks = await getAllTasks(500);

    // Filter to non-completed tasks with due dates in range
    const tasksInRange = allTasks.filter((task) => {
      if (!task.dueDate) return false;
      if (['completed', 'dropped'].includes(task.status)) return false;

      const dueDate = new Date(task.dueDate);
      return dueDate >= startDate && dueDate <= endDate;
    });

    // Group by date
    const forecast: Record<string, Task[]> = {};

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      forecast[dateKey] = [];
    }

    for (const task of tasksInRange) {
      if (task.dueDate) {
        const dateKey = task.dueDate.split('T')[0];
        if (forecast[dateKey]) {
          forecast[dateKey].push(task);
        }
      }
    }

    // Get overdue tasks
    const overdueTasks = allTasks.filter((task) => {
      if (!task.dueDate) return false;
      if (['completed', 'dropped'].includes(task.status)) return false;

      const dueDate = new Date(task.dueDate);
      return dueDate < startDate;
    });

    // Sort overdue by due date
    overdueTasks.sort((a, b) => {
      const dateA = new Date(a.dueDate!);
      const dateB = new Date(b.dueDate!);
      return dateA.getTime() - dateB.getTime();
    });

    return NextResponse.json({
      forecast,
      overdue: overdueTasks,
      range: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days,
      },
    });
  } catch (error) {
    console.error('GET /api/execution/forecast error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch forecast' },
      { status: 500 }
    );
  }
}
