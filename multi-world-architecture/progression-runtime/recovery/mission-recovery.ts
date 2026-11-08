// progression-runtime/recovery/mission-recovery.ts
/**
 * Mission Recovery
 * 
 * Responsibilities:
 * - Persist mission progress, achievements, and grade reports
 * - Restore progression state on reconnect or app restart
 * - Support offline progression by queuing updates
 * 
 * Owned state: none (uses external storage)
 * 
 * Dependencies: ILogger, IMeter, persistence adapter
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: this IS the recovery system
 * Telemetry: save/restore latency
 * Diagnostics: storage size
 * Accessibility: N/A
 * Performance: async writes; batched
 * Forbidden: data loss on disconnect
 */

import type { MissionId, LearnerId, GradeReport, AchievementId } from '../contracts/mission-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class MissionRecovery {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any,
  ) {}

  async saveMissionProgress(learnerId: LearnerId, missionId: MissionId, progress: any): Promise<void> {
    const key = `mission_progress:${learnerId}:${missionId}`;
    await this.storage.set(key, JSON.stringify(progress));
    this.meter.incrementCounter('mission.recovery.saved');
  }

  async loadProgression(learnerId: LearnerId): Promise<any | null> {
    const raw = await this.storage.get(`learner_progression:${learnerId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async saveAchievement(learnerId: LearnerId, achievementId: AchievementId, timestamp: number): Promise<void> {
    const key = `achievements:${learnerId}`;
    const current = await this.storage.get(key) || '[]';
    const list = JSON.parse(current);
    list.push({ achievementId, timestamp });
    await this.storage.set(key, JSON.stringify(list));
  }

  async saveGradeReport(report: GradeReport): Promise<void> {
    const key = `grade_reports:${report.learnerId}`;
    const current = await this.storage.get(key) || '[]';
    const list = JSON.parse(current);
    list.push(report);
    await this.storage.set(key, JSON.stringify(list));
  }
}