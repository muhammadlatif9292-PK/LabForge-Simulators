// AI-tutoring/contracts/tutoring-contracts.ts
/**
 * AI Tutoring Contracts
 * 
 * Responsibilities:
 * - Define strict types for AI tutoring sessions, contexts, missions, assessments, and streaming
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type TutoringSessionId = string & { readonly __brand: 'TutoringSessionId' };
export type MissionId = string & { readonly __brand: 'MissionId' };
export type ObjectiveId = string & { readonly __brand: 'ObjectiveId' };
export type AssessmentId = string & { readonly __brand: 'AssessmentId' };
export type LearnerId = string & { readonly __brand: 'LearnerId' };

export enum TutoringMode {
  EXPLORATION = 'exploration',
  GUIDED = 'guided',
  ASSESSMENT = 'assessment',
  INTERVENTION = 'intervention',
}

export interface TutoringSession {
  id: TutoringSessionId;
  learnerId: LearnerId;
  worldId: string;
  mode: TutoringMode;
  activeMissionId?: MissionId;
  startTime: number;
  lastActivity: number;
  context: TutoringContext;
}

export interface TutoringContext {
  currentTopic: string;
  topicMastery: Record<string, number>; // 0-1 mastery per subtopic
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  attentionLevel: number; // 0-1
  frustrationLevel: number; // 0-1
  recentInteractions: LearnerInteraction[];
  prerequisiteGaps: string[];
}

export interface LearnerInteraction {
  type: 'observation' | 'measurement' | 'question' | 'mistake' | 'correction';
  timestamp: number;
  instrumentId?: string;
  data?: unknown;
}

export interface Mission {
  id: MissionId;
  title: string;
  description: string;
  objectives: Objective[];
  prerequisites: string[];
  difficulty: number; // 1-10
  estimatedDurationMs: number;
  adaptiveHints: boolean;
}

export interface Objective {
  id: ObjectiveId;
  description: string;
  type: 'measure' | 'observe' | 'analyze' | 'predict' | 'explain';
  completionCriteria: Record<string, unknown>;
  hints: string[];
  scoreWeight: number;
}

export interface Assessment {
  id: AssessmentId;
  sessionId: TutoringSessionId;
  type: 'formative' | 'summative' | 'diagnostic';
  questions: AssessmentQuestion[];
  score?: number;
  completedAt?: number;
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  expectedAnswer: unknown;
  tolerance?: number; // for numeric answers
  explanation: string;
}

export interface StreamedTutorResponse {
  chunk: string;
  isFinal: boolean;
  reasoningTrace?: string[];
  suggestedAction?: string;
}