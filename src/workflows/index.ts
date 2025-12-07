/**
 * Workflows Module - Public API
 */

export * from './sequencer';

import type { WorkflowPattern, WorkflowStep } from '@/domain';

// Built-in workflow patterns
export function getWorkflowPattern(name: string): WorkflowPattern | null {
  const patterns: Record<string, WorkflowPattern> = {
    'research-synthesis': {
      id: 'research-synthesis',
      name: 'Research & Synthesis',
      description: 'Multi-step research with synthesis',
      steps: [
        { stepId: 'step-1', groupId: 'research', agentType: 'research_agent', objectiveTemplate: 'Research the topic', isBlocking: false, inputArtifacts: [], outputArtifacts: ['research-notes'] },
        { stepId: 'step-2', groupId: 'synthesis', agentType: 'writer_agent', objectiveTemplate: 'Synthesize findings', isBlocking: true, inputArtifacts: ['research-notes'], outputArtifacts: ['synthesis'] },
      ],
      qaProfileId: 'balanced',
      expectedArtifacts: ['research-notes', 'synthesis'],
    },
    'email-resolution': {
      id: 'email-resolution',
      name: 'Email Resolution',
      description: 'Draft and review email response',
      steps: [
        { stepId: 'step-1', groupId: 'draft', agentType: 'writer_agent', objectiveTemplate: 'Draft email response', isBlocking: true, inputArtifacts: [], outputArtifacts: ['email-draft'] },
      ],
      qaProfileId: 'high_rigor',
      expectedArtifacts: ['email-draft'],
    },
    'weekly-planning': {
      id: 'weekly-planning',
      name: 'Weekly Planning',
      description: 'Plan and organize weekly tasks',
      steps: [
        { stepId: 'step-1', groupId: 'review', agentType: 'research_agent', objectiveTemplate: 'Review current tasks', isBlocking: false, inputArtifacts: [], outputArtifacts: ['task-review'] },
        { stepId: 'step-2', groupId: 'plan', agentType: 'planner_agent', objectiveTemplate: 'Create weekly plan', isBlocking: true, inputArtifacts: ['task-review'], outputArtifacts: ['weekly-plan'] },
      ],
      qaProfileId: 'balanced',
      expectedArtifacts: ['task-review', 'weekly-plan'],
    },
    'meeting-prep': {
      id: 'meeting-prep',
      name: 'Meeting Prep',
      description: 'Prepare for upcoming meeting',
      steps: [
        { stepId: 'step-1', groupId: 'research', agentType: 'research_agent', objectiveTemplate: 'Research attendees and topics', isBlocking: false, inputArtifacts: [], outputArtifacts: ['meeting-brief'] },
      ],
      qaProfileId: 'fast_draft',
      expectedArtifacts: ['meeting-brief'],
    },
    'decision-brief': {
      id: 'decision-brief',
      name: 'Decision Brief',
      description: 'Create decision analysis',
      steps: [
        { stepId: 'step-1', groupId: 'research', agentType: 'research_agent', objectiveTemplate: 'Research options', isBlocking: false, inputArtifacts: [], outputArtifacts: ['options-analysis'] },
        { stepId: 'step-2', groupId: 'write', agentType: 'writer_agent', objectiveTemplate: 'Write decision brief', isBlocking: true, inputArtifacts: ['options-analysis'], outputArtifacts: ['decision-brief'] },
      ],
      qaProfileId: 'high_rigor',
      expectedArtifacts: ['options-analysis', 'decision-brief'],
    },
    'multi-step-research': {
      id: 'multi-step-research',
      name: 'Multi-Step Research',
      description: 'Deep research with multiple iterations',
      steps: [
        { stepId: 'step-1', groupId: 'initial', agentType: 'research_agent', objectiveTemplate: 'Initial research', isBlocking: false, inputArtifacts: [], outputArtifacts: ['initial-findings'] },
        { stepId: 'step-2', groupId: 'deep', agentType: 'research_agent', objectiveTemplate: 'Deep dive research', isBlocking: false, inputArtifacts: ['initial-findings'], outputArtifacts: ['deep-findings'] },
        { stepId: 'step-3', groupId: 'synthesis', agentType: 'writer_agent', objectiveTemplate: 'Synthesize all findings', isBlocking: true, inputArtifacts: ['deep-findings'], outputArtifacts: ['research-report'] },
      ],
      qaProfileId: 'high_rigor',
      expectedArtifacts: ['initial-findings', 'deep-findings', 'research-report'],
    },
  };

  return patterns[name] ?? null;
}
