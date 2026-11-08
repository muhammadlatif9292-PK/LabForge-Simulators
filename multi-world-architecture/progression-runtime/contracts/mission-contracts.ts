// progression-runtime/contracts/mission-contracts.ts
/**
 * Mission & Progression Contracts
 * 
 * Responsibilities:
 * - Define strict types for missions, objectives, achievements, grading, and progression
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

export type MissionId = string & { readonly __brand: 'MissionId' };
export type ObjectiveId = string & { readonly __brand: 'ObjectiveId' };
export type AchievementId = string & { readonly __brand: 'AchievementId' };
export type LearnerId = string & { readonly __brand: 'LearnerId' };
export type GradeReportId = string & { readonly __brand: 'GradeReportId' };

export enum MissionState {
  LOCKED = 'locked',
  AVAILABLE = 'available',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ObjectiveType {
  MEASURE = 'measure',
  OBSERVE = 'observe',
  ANALYZE = 'analyze',
  PREDICT = 'predict',
  EXPLAIN = 'explain',
  CALCULATE = 'calculate',
}

export interface Objective {
  id: ObjectiveId;
  description: string;
  type: ObjectiveType;
  completionCriteria: Record<string, unknown>;
  hints: string[];
  scoreWeight: number;
}

export interface Mission {
  id: MissionId;
  title: string;
  description: string;
  worldId: string;
  prerequisites: MissionId[];
  objectives: Objective[];
  difficulty: number; // 1-10
  estimatedDurationMs: number;
  adaptiveHints: boolean;
  state: MissionState;
}

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  criteria: AchievementCriteria;
  iconUrl: string;
  points: number;
  hiddenUntil: AchievementId[];
}

export type AchievementCriteria =
  | { type: 'mission_completed'; missionId: MissionId }
  | { type: 'measurement_accuracy'; instrumentId: string; threshold: number }
  | { type: 'consecutive_correct'; count: number }
  | { type: 'worlds_explored'; count: number }
  | { type: 'collaboration_sessions'; count: number };

export interface LearnerProgression {
  learnerId: LearnerId;
  completedMissions: Map<MissionId, number>; // timestamp completed
  unlockedAchievements: Set<AchievementId>;
  scores: Map<MissionId, number>;
  skillLevels: Record<string, number>;
  totalPoints: number;
  lastActivity: number;
}

export interface GradeReport {
  id: GradeReportId;
  learnerId: LearnerId;
  missionId: MissionId;
  objectiveScores: Map<ObjectiveId, number>;
  overallScore: number;
  feedback: string;
  timestamp: number;
  gradedBy: 'system' | 'instructor';
}

export interface ProgressionHealth {
  activeMissions: number;
  completedMissions: number;
  achievementCount: number;
  averageScore: number;
  lastGradedAt?: number;
}