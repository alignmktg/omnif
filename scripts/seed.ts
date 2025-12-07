/**
 * Seed Script
 * Populates database with initial test data
 * Run with: npx tsx scripts/seed.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../src/graph/schema';

const { projects, tasks } = schema;

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  console.log('Seeding database...');

  // Create 2 projects
  const proj1Id = uuidv4();
  const proj2Id = uuidv4();

  await db.insert(projects).values([
    {
      id: proj1Id,
      name: 'POF Development',
      notes: 'Building the Productivity Orchestration Framework',
      type: 'parallel',
      status: 'active',
    },
    {
      id: proj2Id,
      name: 'Q4 Planning',
      notes: 'Strategic planning for Q4 initiatives',
      type: 'sequential',
      status: 'active',
    },
  ]);
  console.log('Created 2 projects');

  // Create 8 tasks with varied statuses
  await db.insert(tasks).values([
    // Inbox tasks (no project)
    {
      id: uuidv4(),
      title: 'Review PRD feedback from stakeholders',
      notes: 'Check email thread for latest comments',
      status: 'inbox',
      priority: 'high',
      tags: ['review', 'prd'],
    },
    {
      id: uuidv4(),
      title: 'Set up Helicone dashboard',
      notes: 'Configure observability for AI calls',
      status: 'inbox',
      priority: 'normal',
      tags: ['devops', 'monitoring'],
    },
    {
      id: uuidv4(),
      title: 'Write API documentation',
      notes: 'Document all endpoints in /api',
      status: 'inbox',
      priority: 'low',
      tags: ['docs'],
    },
    // Available tasks (with project)
    {
      id: uuidv4(),
      title: 'Fix chat response latency',
      notes: 'Target < 3 seconds for concierge responses',
      status: 'available',
      priority: 'critical',
      projectId: proj1Id,
      tags: ['performance', 'bug'],
    },
    {
      id: uuidv4(),
      title: 'Add task completion animation',
      notes: 'Satisfying feedback when marking tasks done',
      status: 'available',
      priority: 'normal',
      projectId: proj1Id,
      tags: ['ux'],
    },
    {
      id: uuidv4(),
      title: 'Design Q4 roadmap',
      notes: 'Identify key milestones and dependencies',
      status: 'available',
      priority: 'high',
      projectId: proj2Id,
      tags: ['planning', 'strategy'],
    },
    // Completed tasks
    {
      id: uuidv4(),
      title: 'Initial project setup',
      notes: 'Next.js + TypeScript + Tailwind configured',
      status: 'completed',
      priority: 'normal',
      projectId: proj1Id,
      tags: ['setup'],
    },
    {
      id: uuidv4(),
      title: 'Database schema migration',
      notes: 'Drizzle ORM with Neon Postgres',
      status: 'completed',
      priority: 'high',
      projectId: proj1Id,
      tags: ['database'],
    },
  ]);
  console.log('Created 8 tasks');

  console.log('Seed completed successfully!');
  console.log('- 2 projects');
  console.log('- 3 inbox tasks');
  console.log('- 3 available tasks');
  console.log('- 2 completed tasks');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
