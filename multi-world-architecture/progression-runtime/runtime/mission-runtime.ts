// progression-runtime/runtime/mission-runtime.ts
/**
 * Mission Runtime
 * 
 * Responsibilities:
 * - Manage the lifecycle of a mission within a tutoring session
 * - Track objective completion and trigger hints when learner is stuck
 * - Coordinate with tutoring runtime for adaptive interventions
 * - Persist mission progress for offline replay and recovery
 * 
 * Owned state:
 * - activeMissions: Map<MissionId, MissionProgress>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - ObjectiveEngine
 * - AdaptiveProgression
 * - MissionRecovery
 * 
 * Event emissions: "mission.started", "mission.objective.completed", "mission.completed", "mission.failed"
 * Event subscriptions:
 * - "instrument.measurement.recorded" (to check objectives)
 * - "learner.question" (to detect struggle)
 * 
 * Synchronization: per-user mission state; no cross-user coordination
 * Recovery: mission progress persisted via recovery engine
 * Telemetry: mission completion rate, time to complete
 * Diagnostics: active objectives, hint usage
 * Accessibility: mission text screen-readable
 * Performance: lightweight objective checking; async persistence
 * Forbidden: skipping prerequisite missions; revealing answers in hints
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  MissionId, Mission, Objective, ObjectiveId, MissionState,
} from '../contracts/mission-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ObjectiveEngine } from './objective-engine';
import type { AdaptiveProgression } from './adaptive-progression';
import type { MissionRecovery } from './mission-recovery';

interface MissionProgress {
  mission: Mission;
  completedObjectives: Set<ObjectiveId>;
  currentHintIndex: Map<ObjectiveId, number>;
  startedAt: number;
  lastActivity: number;
}

export class MissionRuntime {
  private activeMissions: Map<MissionId, MissionProgress> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private objectiveEngine: ObjectiveEngine,
    private adaptiveProgression: AdaptiveProgression,
    private recovery: MissionRecovery,
  ) {
    this.eventBus.subscribe('instrument.measurement.recorded', this.onMeasurement.bind(this));
    this.eventBus.subscribe('learner.question', this.onLearnerQuestion.bind(this));
  }

  async startMission(mission: Mission, learnerId: string, sessionId: string): Promise<void> {
    if (this.activeMissions.has(mission.id)) return;
    // Check prerequisites
    const progression = await this.recovery.loadProgression(learnerId);
    for (const prereqId of mission.prerequisites) {
      if (!progression?.completedMissions.has(prereqId)) {
        throw new Error(`Prerequisite mission not completed: ${prereqId}`);
      }
    }
    const progress: MissionProgress = {
      mission: { ...mission, state: MissionState.ACTIVE },
      completedObjectives: new Set(),
      currentHintIndex: new Map(),
      startedAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.activeMissions.set(mission.id, progress);
    await this.recovery.saveMissionProgress(learnerId, mission.id, progress);
    await this.eventBus.publish('mission.started', { missionId: mission.id, learnerId, sessionId });
    this.meter.incrementCounter('mission.started');
    this.logger.info(`Mission started: ${mission.title}`);
  }

  private async onMeasurement(event: any): Promise<void> {
    const { instrumentId, value, unit } = event.payload;
    for (const [missionId, progress] of this.activeMissions) {
      const completed = await this.objectiveEngine.evaluateObjective(
        progress.mission.objectives.filter(o => !progress.completedObjectives.has(o.id)),
        { instrumentId, value, unit },
      );
      if (completed) {
        progress.completedObjectives.add(completed.id);
        progress.lastActivity = Date.now();
        await this.eventBus.publish('mission.objective.completed', {
          missionId,
          objectiveId: completed.id,
        });
        this.checkMissionCompletion(missionId, progress);
      }
    }
  }

  private async onLearnerQuestion(event: any): Promise<void> {
    // If learner is asking questions, they may need hints
    for (const [missionId, progress] of this.activeMissions) {
      const incompleteObjectives = progress.mission.objectives.filter(o => !progress.completedObjectives.has(o.id));
      if (incompleteObjectives.length > 0) {
        const hint = this.objectiveEngine.getNextHint(incompleteObjectives[0], progress.currentHintIndex);
        if (hint) {
          await this.eventBus.publish('mission.hint', { missionId, hint });
        }
      }
    }
  }

  private async checkMissionCompletion(missionId: MissionId, progress: MissionProgress): Promise<void> {
    if (progress.completedObjectives.size >= progress.mission.objectives.length) {
      progress.mission.state = MissionState.COMPLETED;
      await this.eventBus.publish('mission.completed', { missionId });
      this.meter.incrementCounter('mission.completed');
      this.activeMissions.delete(missionId);
      this.logger.info(`Mission completed: ${progress.mission.title}`);
    }
  }

  async getHint(missionId: MissionId, objectiveId: ObjectiveId): Promise<string | null> {
    const progress = this.activeMissions.get(missionId);
    if (!progress) return null;
    const objective = progress.mission.objectives.find(o => o.id === objectiveId);
    if (!objective) return null;
    const hint = this.objectiveEngine.getNextHint(objective, progress.currentHintIndex);
    if (hint) this.meter.incrementCounter('mission.hint.used');
    return hint;
  }

  async shutdown(): Promise<void> {
    for (const [id, progress] of this.activeMissions) {
      await this.recovery.saveMissionProgress('learner', id, progress);
    }
    this.activeMissions.clear();
  }
}