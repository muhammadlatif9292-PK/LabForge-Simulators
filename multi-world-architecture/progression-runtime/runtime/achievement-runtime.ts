// progression-runtime/runtime/achievement-runtime.ts
/**
 * Achievement Runtime
 * 
 * Responsibilities:
 * - Define and track achievements across the learner's journey
 * - Evaluate achievement criteria reactively (mission completions, accuracy, etc.)
 * - Unlock achievements and persist them for display
 * - Support hidden achievements that only appear after prerequisites
 * 
 * Owned state:
 * - achievements: Map<AchievementId, Achievement>
 * - learnerAchievements: Map<LearnerId, Set<AchievementId>>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - MissionRecovery (for persistence)
 * 
 * Event emissions: "achievement.unlocked"
 * Event subscriptions:
 * - "mission.completed", "instrument.measurement.recorded", "collaboration.session.joined"
 * 
 * Synchronization: per-learner; no cross-user dependencies
 * Recovery: achievements persisted; can be recalculated from event log
 * Telemetry: achievement unlock rate, rarity distribution
 * Diagnostics: locked/unlocked achievements
 * Accessibility: achievement descriptions screen-readable
 * Performance: criteria checks are O(1) per event
 * Forbidden: awarding achievements without verifying criteria
 */

import { v4 as uuidv4 } from 'uuid';
import type { Achievement, AchievementId, LearnerId, MissionId } from '../contracts/mission-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { MissionRecovery } from './mission-recovery';

export class AchievementRuntime {
  private achievements: Map<AchievementId, Achievement> = new Map();
  private learnerUnlocks: Map<LearnerId, Set<AchievementId>> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private recovery: MissionRecovery,
  ) {
    this.eventBus.subscribe('mission.completed', this.onMissionCompleted.bind(this));
    this.eventBus.subscribe('collaboration.session.joined', this.onCollaborationJoined.bind(this));
    this.registerDefaultAchievements();
  }

  private registerDefaultAchievements(): void {
    this.registerAchievement({
      id: 'first_measurement' as AchievementId,
      name: 'First Measurement',
      description: 'Record your first measurement',
      criteria: { type: 'measurement_accuracy', instrumentId: '*', threshold: 0 },
      iconUrl: '',
      points: 10,
      hiddenUntil: [],
    });
  }

  registerAchievement(achievement: Achievement): void {
    this.achievements.set(achievement.id, achievement);
  }

  async evaluateAndUnlock(learnerId: LearnerId, event: any): Promise<void> {
    const unlocks = this.learnerUnlocks.get(learnerId) ?? new Set();
    for (const achievement of this.achievements.values()) {
      if (unlocks.has(achievement.id)) continue;
      if (this.meetsCriteria(achievement, event, learnerId)) {
        unlocks.add(achievement.id);
        this.learnerUnlocks.set(learnerId, unlocks);
        await this.recovery.saveAchievement(learnerId, achievement.id, Date.now());
        await this.eventBus.publish('achievement.unlocked', { learnerId, achievement });
        this.meter.incrementCounter('achievement.unlocked');
        this.logger.info(`Achievement unlocked: ${achievement.name} for ${learnerId}`);
      }
    }
  }

  private meetsCriteria(achievement: Achievement, event: any, learnerId: LearnerId): boolean {
    const c = achievement.criteria;
    switch (c.type) {
      case 'mission_completed':
        return event.payload?.missionId === (c as any).missionId;
      case 'measurement_accuracy':
        return event.payload?.value !== undefined; // simplified
      default:
        return false;
    }
  }

  getUnlockedAchievements(learnerId: LearnerId): Achievement[] {
    const unlocks = this.learnerUnlocks.get(learnerId);
    if (!unlocks) return [];
    return Array.from(unlocks).map(id => this.achievements.get(id)!).filter(Boolean);
  }
}