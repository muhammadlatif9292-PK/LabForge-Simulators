// AI-tutoring/agents/mission-guidance-agent.ts
/**
 * Mission Guidance Agent
 * 
 * Responsibilities:
 * - Guide learner through a mission by tracking objective completion
 * - Provide contextual hints when the learner appears stuck
 * - Adapt mission difficulty based on learner performance
 * - Evaluate measurements and observations against objective criteria
 * 
 * Owned state:
 * - activeMissions: Map<MissionId, MissionState>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - ScientificReasoningEngine (to validate answers)
 * 
 * Event emissions: "mission.objective.completed", "mission.completed"
 * Event subscriptions: none
 * Synchronization: mission state per session; no cross-session coordination
 * Recovery: mission progress saved in context; restored on reconnect
 * Telemetry: mission completion rate, hint usage
 * Diagnostics: active mission objectives
 * Accessibility: mission text must be screen-readable
 * Performance: O(1) objective lookup; hints generated async
 * Forbidden: giving away the answer without educational value
 */

import type { Mission, Objective, ObjectiveId, TutoringSession } from '../contracts/tutoring-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface MissionState {
  mission: Mission;
  completedObjectives: Set<ObjectiveId>;
  currentHintIndex: Map<ObjectiveId, number>;
}

export class MissionGuidanceAgent {
  private missions: Map<string, MissionState> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  async startMission(mission: Mission, session: TutoringSession): Promise<void> {
    this.missions.set(session.id, {
      mission,
      completedObjectives: new Set(),
      currentHintIndex: new Map(),
    });
    this.logger.info(`Mission started: ${mission.title} for session ${session.id}`);
  }

  async evaluateObjective(measurement: any, session: TutoringSession): Promise<Objective | null> {
    const state = this.missions.get(session.id);
    if (!state) return null;

    for (const objective of state.mission.objectives) {
      if (state.completedObjectives.has(objective.id)) continue;
      const met = this.checkCriteria(objective, measurement);
      if (met) {
        state.completedObjectives.add(objective.id);
        this.meter.incrementCounter('mission.objective.completed');
        await this.eventBus.publish('mission.objective.completed', {
          sessionId: session.id,
          objectiveId: objective.id,
        });
        // Check mission completion
        if (state.completedObjectives.size === state.mission.objectives.length) {
          await this.eventBus.publish('mission.completed', {
            sessionId: session.id,
            missionId: state.mission.id,
          });
          this.logger.info(`Mission completed: ${state.mission.title}`);
        }
        return objective;
      }
    }
    return null;
  }

  getNextHint(objectiveId: ObjectiveId, session: TutoringSession): string | null {
    const state = this.missions.get(session.id);
    if (!state) return null;
    const objective = state.mission.objectives.find(o => o.id === objectiveId);
    if (!objective) return null;
    const idx = state.currentHintIndex.get(objectiveId) ?? 0;
    if (idx >= objective.hints.length) return null;
    const hint = objective.hints[idx];
    state.currentHintIndex.set(objectiveId, idx + 1);
    this.meter.incrementCounter('mission.hint.used');
    return hint;
  }

  private checkCriteria(objective: Objective, measurement: any): boolean {
    // Simplified: compare measurement type and value range
    if (objective.type === 'measure') {
      const criteria = objective.completionCriteria as { expectedValue: number; tolerance: number };
      if (typeof measurement.value === 'number') {
        return Math.abs(measurement.value - criteria.expectedValue) <= criteria.tolerance;
      }
    }
    return false;
  }
}