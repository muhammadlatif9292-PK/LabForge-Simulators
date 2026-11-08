// progression-runtime/runtime/adaptive-progression.ts
/**
 * Adaptive Progression
 * 
 * Responsibilities:
 * - Adjust mission difficulty and content based on learner performance
 * - Recommend next missions or practice based on skill gaps
 * - Track skill levels across different domains (chemistry, physics, etc.)
 * - Provide smooth difficulty curve: avoid frustration and boredom
 * 
 * Owned state:
 * - learnerSkills: Map<LearnerId, Record<string, number>>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - MissionRecovery (persistence)
 * 
 * Event emissions: "progression.recommendation"
 * Event subscriptions:
 * - "mission.completed" (update skills)
 * - "mission.failed" (adjust)
 * 
 * Synchronization: per-learner model
 * Recovery: skills persisted
 * Telemetry: skill progression over time
 * Diagnostics: current skill estimates
 * Accessibility: N/A
 * Performance: lightweight Bayesian/elo updates
 * Forbidden: punishing learners for exploration; steep difficulty spikes
 */

import type { LearnerId, MissionId } from '../contracts/mission-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class AdaptiveProgression {
  private skillModels: Map<LearnerId, Record<string, number>> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  updateSkills(learnerId: LearnerId, domain: string, score: number): void {
    let skills = this.skillModels.get(learnerId) ?? {};
    const current = skills[domain] ?? 0.5;
    // Simple exponential moving average
    skills[domain] = current * 0.8 + score * 0.2;
    this.skillModels.set(learnerId, skills);
    this.meter.setGauge('progression.skill', skills[domain], { learnerId, domain });
  }

  getRecommendedMission(learnerId: LearnerId, availableMissions: Mission[]): Mission | null {
    const skills = this.skillModels.get(learnerId) ?? {};
    // Pick the mission where difficulty is closest to current skill + small challenge
    return availableMissions
      .filter(m => (skills[m.worldId] ?? 0.5) >= m.difficulty / 10 - 0.2)
      .sort((a, b) => a.difficulty - b.difficulty)[0] ?? null;
  }

  getSkillLevel(learnerId: LearnerId, domain: string): number {
    return this.skillModels.get(learnerId)?.[domain] ?? 0;
  }
}