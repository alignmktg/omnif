/**
 * Built-in Workflow Patterns
 * 8 patterns as specified in PRD Section 9
 */

import type { WorkflowPattern } from '@/domain';

// ============================================================================
// RESEARCH & SYNTHESIS
// ============================================================================

export const RESEARCH_SYNTHESIS: WorkflowPattern = {
  id: 'research-synthesis',
  name: 'Research & Synthesis',
  description: 'Gather information from multiple sources and synthesize into insights',
  steps: [
    {
      stepId: 'gather',
      agentType: 'research_agent',
      objectiveTemplate: 'Research and gather information about: {{topic}}',
      groupId: 'research',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['raw_research'],
    },
    {
      stepId: 'analyze',
      agentType: 'research_agent',
      objectiveTemplate: 'Analyze the following research and identify key themes and patterns:\n\n{{raw_research}}',
      groupId: 'analysis',
      isBlocking: true,
      inputArtifacts: ['raw_research'],
      outputArtifacts: ['analysis'],
    },
    {
      stepId: 'synthesize',
      agentType: 'writer_agent',
      objectiveTemplate: 'Synthesize the analysis into a clear, actionable summary:\n\n{{analysis}}',
      groupId: 'synthesis',
      isBlocking: true,
      inputArtifacts: ['analysis'],
      outputArtifacts: ['synthesis'],
    },
  ],
  qaProfileId: 'balanced',
  expectedArtifacts: ['synthesis'],
};

// ============================================================================
// ARTICLE CREATION
// ============================================================================

export const ARTICLE_CREATION: WorkflowPattern = {
  id: 'article-creation',
  name: 'Article Creation',
  description: 'Create a polished article from topic to final draft',
  steps: [
    {
      stepId: 'outline',
      agentType: 'planner_agent',
      objectiveTemplate: 'Create a detailed outline for an article about: {{topic}}\n\nTarget audience: {{audience}}\nTone: {{tone}}',
      groupId: 'planning',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['outline'],
    },
    {
      stepId: 'draft',
      agentType: 'writer_agent',
      objectiveTemplate: 'Write a first draft based on this outline:\n\n{{outline}}',
      groupId: 'drafting',
      isBlocking: true,
      inputArtifacts: ['outline'],
      outputArtifacts: ['draft'],
    },
    {
      stepId: 'revise',
      agentType: 'writer_agent',
      objectiveTemplate: 'Revise and improve this draft for clarity, flow, and engagement:\n\n{{draft}}',
      groupId: 'revision',
      isBlocking: true,
      inputArtifacts: ['draft'],
      outputArtifacts: ['revised_draft'],
    },
    {
      stepId: 'finalize',
      agentType: 'writer_agent',
      objectiveTemplate: 'Polish and finalize this article, ensuring consistency and professional quality:\n\n{{revised_draft}}',
      groupId: 'finalization',
      isBlocking: true,
      inputArtifacts: ['revised_draft'],
      outputArtifacts: ['final_article'],
    },
  ],
  qaProfileId: 'high_rigor',
  expectedArtifacts: ['final_article'],
};

// ============================================================================
// MEETING PREP & SUMMARY
// ============================================================================

export const MEETING_PREP: WorkflowPattern = {
  id: 'meeting-prep',
  name: 'Meeting Prep & Summary',
  description: 'Prepare for a meeting with context gathering and agenda creation',
  steps: [
    {
      stepId: 'gather_context',
      agentType: 'research_agent',
      objectiveTemplate: 'Gather relevant context for a meeting about: {{meeting_topic}}\n\nAttendees: {{attendees}}\nPrevious context: {{previous_context}}',
      groupId: 'research',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['meeting_context'],
    },
    {
      stepId: 'create_agenda',
      agentType: 'planner_agent',
      objectiveTemplate: 'Create a structured meeting agenda based on this context:\n\n{{meeting_context}}\n\nMeeting goals: {{goals}}',
      groupId: 'planning',
      isBlocking: true,
      inputArtifacts: ['meeting_context'],
      outputArtifacts: ['agenda'],
    },
    {
      stepId: 'prep_notes',
      agentType: 'writer_agent',
      objectiveTemplate: 'Create preparation notes and talking points for each agenda item:\n\n{{agenda}}',
      groupId: 'preparation',
      isBlocking: true,
      inputArtifacts: ['agenda'],
      outputArtifacts: ['prep_notes'],
    },
  ],
  qaProfileId: 'balanced',
  expectedArtifacts: ['agenda', 'prep_notes'],
};

// ============================================================================
// EMAIL THREAD RESOLUTION
// ============================================================================

export const EMAIL_RESOLUTION: WorkflowPattern = {
  id: 'email-resolution',
  name: 'Email Thread Resolution',
  description: 'Analyze an email thread and draft an appropriate response',
  steps: [
    {
      stepId: 'analyze_thread',
      agentType: 'research_agent',
      objectiveTemplate: 'Analyze this email thread and identify:\n- Key points\n- Questions asked\n- Action items\n- Sentiment\n\nThread:\n{{email_thread}}',
      groupId: 'analysis',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['thread_analysis'],
    },
    {
      stepId: 'draft_response',
      agentType: 'writer_agent',
      objectiveTemplate: 'Draft a professional response to this email thread based on the analysis:\n\n{{thread_analysis}}\n\nResponse guidelines: {{guidelines}}',
      groupId: 'drafting',
      isBlocking: true,
      inputArtifacts: ['thread_analysis'],
      outputArtifacts: ['draft_response'],
    },
  ],
  qaProfileId: 'high_rigor',
  expectedArtifacts: ['draft_response'],
};

// ============================================================================
// DECISION SUPPORT BRIEF
// ============================================================================

export const DECISION_BRIEF: WorkflowPattern = {
  id: 'decision-brief',
  name: 'Decision Support Brief',
  description: 'Gather options, analyze tradeoffs, and provide a recommendation',
  steps: [
    {
      stepId: 'gather_options',
      agentType: 'research_agent',
      objectiveTemplate: 'Identify and research the available options for: {{decision}}\n\nConstraints: {{constraints}}',
      groupId: 'research',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['options'],
    },
    {
      stepId: 'analyze_tradeoffs',
      agentType: 'research_agent',
      objectiveTemplate: 'Analyze the tradeoffs for each option:\n\n{{options}}\n\nEvaluation criteria: {{criteria}}',
      groupId: 'analysis',
      isBlocking: true,
      inputArtifacts: ['options'],
      outputArtifacts: ['tradeoff_analysis'],
    },
    {
      stepId: 'recommend',
      agentType: 'planner_agent',
      objectiveTemplate: 'Provide a clear recommendation based on the analysis:\n\n{{tradeoff_analysis}}\n\nPriorities: {{priorities}}',
      groupId: 'recommendation',
      isBlocking: true,
      inputArtifacts: ['tradeoff_analysis'],
      outputArtifacts: ['recommendation'],
    },
  ],
  qaProfileId: 'high_rigor',
  expectedArtifacts: ['recommendation'],
};

// ============================================================================
// DEEP WORK CYCLE
// ============================================================================

export const DEEP_WORK_CYCLE: WorkflowPattern = {
  id: 'deep-work-cycle',
  name: 'Deep Work Cycle',
  description: 'Plan and support a focused deep work session',
  steps: [
    {
      stepId: 'define_focus',
      agentType: 'planner_agent',
      objectiveTemplate: 'Define the focus and success criteria for a deep work session on: {{work_topic}}\n\nAvailable time: {{duration}}',
      groupId: 'planning',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['focus_plan'],
    },
    {
      stepId: 'block_time',
      agentType: 'integrations_agent',
      objectiveTemplate: 'Prepare calendar and environment for deep work:\n\n{{focus_plan}}',
      groupId: 'setup',
      isBlocking: true,
      inputArtifacts: ['focus_plan'],
      outputArtifacts: ['session_setup'],
    },
    {
      stepId: 'review',
      agentType: 'planner_agent',
      objectiveTemplate: 'Review the deep work session outcomes and capture learnings:\n\nOriginal plan: {{focus_plan}}\nSession notes: {{session_notes}}',
      groupId: 'review',
      isBlocking: true,
      inputArtifacts: ['focus_plan'],
      outputArtifacts: ['session_review'],
    },
  ],
  qaProfileId: 'fast_draft',
  expectedArtifacts: ['focus_plan', 'session_review'],
};

// ============================================================================
// MULTI-STEP RESEARCH LOOP
// ============================================================================

export const MULTI_STEP_RESEARCH: WorkflowPattern = {
  id: 'multi-step-research',
  name: 'Multi-Step Research Loop',
  description: 'Iterative research with expansion and validation',
  steps: [
    {
      stepId: 'initial_query',
      agentType: 'research_agent',
      objectiveTemplate: 'Conduct initial research on: {{research_question}}',
      groupId: 'initial',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['initial_findings'],
    },
    {
      stepId: 'expand',
      agentType: 'research_agent',
      objectiveTemplate: 'Expand on the initial findings and explore related areas:\n\n{{initial_findings}}\n\nAreas to explore: {{expansion_areas}}',
      groupId: 'expansion',
      isBlocking: true,
      inputArtifacts: ['initial_findings'],
      outputArtifacts: ['expanded_research'],
    },
    {
      stepId: 'synthesize',
      agentType: 'writer_agent',
      objectiveTemplate: 'Synthesize all research into a comprehensive summary:\n\n{{expanded_research}}',
      groupId: 'synthesis',
      isBlocking: true,
      inputArtifacts: ['expanded_research'],
      outputArtifacts: ['research_synthesis'],
    },
    {
      stepId: 'validate',
      agentType: 'research_agent',
      objectiveTemplate: 'Validate the synthesis and identify any gaps or uncertainties:\n\n{{research_synthesis}}',
      groupId: 'validation',
      isBlocking: true,
      inputArtifacts: ['research_synthesis'],
      outputArtifacts: ['validated_research'],
    },
  ],
  qaProfileId: 'balanced',
  expectedArtifacts: ['validated_research'],
};

// ============================================================================
// WEEKLY PLANNING
// ============================================================================

export const WEEKLY_PLANNING: WorkflowPattern = {
  id: 'weekly-planning',
  name: 'Weekly Planning Workflow',
  description: 'Review the past week and plan the upcoming week',
  steps: [
    {
      stepId: 'review_past',
      agentType: 'planner_agent',
      objectiveTemplate: 'Review the past week:\n- What was accomplished?\n- What was missed?\n- Key learnings?\n\nPast week data: {{past_week_summary}}',
      groupId: 'review',
      isBlocking: true,
      inputArtifacts: [],
      outputArtifacts: ['week_review'],
    },
    {
      stepId: 'identify_priorities',
      agentType: 'planner_agent',
      objectiveTemplate: 'Identify priorities for the upcoming week based on:\n\n{{week_review}}\n\nGoals: {{goals}}\nCommitments: {{commitments}}',
      groupId: 'prioritization',
      isBlocking: true,
      inputArtifacts: ['week_review'],
      outputArtifacts: ['weekly_priorities'],
    },
    {
      stepId: 'schedule',
      agentType: 'integrations_agent',
      objectiveTemplate: 'Create a weekly schedule based on priorities:\n\n{{weekly_priorities}}\n\nAvailable time blocks: {{availability}}',
      groupId: 'scheduling',
      isBlocking: true,
      inputArtifacts: ['weekly_priorities'],
      outputArtifacts: ['weekly_schedule'],
    },
  ],
  qaProfileId: 'balanced',
  expectedArtifacts: ['week_review', 'weekly_priorities', 'weekly_schedule'],
};

// ============================================================================
// PATTERN REGISTRY
// ============================================================================

export const WORKFLOW_PATTERNS: Record<string, WorkflowPattern> = {
  'research-synthesis': RESEARCH_SYNTHESIS,
  'article-creation': ARTICLE_CREATION,
  'meeting-prep': MEETING_PREP,
  'email-resolution': EMAIL_RESOLUTION,
  'decision-brief': DECISION_BRIEF,
  'deep-work-cycle': DEEP_WORK_CYCLE,
  'multi-step-research': MULTI_STEP_RESEARCH,
  'weekly-planning': WEEKLY_PLANNING,
};

/**
 * Get a workflow pattern by ID
 */
export function getWorkflowPattern(id: string): WorkflowPattern | undefined {
  return WORKFLOW_PATTERNS[id];
}

/**
 * Get all available workflow patterns
 */
export function getAllWorkflowPatterns(): WorkflowPattern[] {
  return Object.values(WORKFLOW_PATTERNS);
}

/**
 * Get workflow patterns by expected artifact
 */
export function getPatternsByArtifact(artifact: string): WorkflowPattern[] {
  return Object.values(WORKFLOW_PATTERNS).filter((p) =>
    p.expectedArtifacts.includes(artifact)
  );
}
