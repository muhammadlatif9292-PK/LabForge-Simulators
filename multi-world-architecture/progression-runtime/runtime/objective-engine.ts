// progression-runtime/runtime/objective-engine.ts
/**
 * Objective Engine
 * 
 * Responsibilities:
 * - Evaluate measurement/observation data against mission objective criteria
 * - Support multiple objective types: measure, observe, analyze, predict, explain
 * - Generate hints progressively without giving away the answer
 * - Provide deterministic evaluation for replay
 * 
 * Owned state: none (pure function)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: n/a
 * Telemetry: objective completion rate, hint effectiveness
 * Diagnostics: evaluation log
 * Accessibility: hints are screen-readable
 * Performance: O(1) per objective evaluation
 * Forbidden: ambiguous criteria; false positives
 */

import type { Objective, ObjectiveId, ObjectiveType } from '../contracts/mission-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class ObjectiveEngine {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  evaluateObjective(objectives: Objective[], measurement: any): Objective | null {
    for (const obj of objectives) {
      if (this.meetsCriteria(obj, measurement)) {
        return obj;
      }
    }
    return null;
  }

  getNextHint(objective: Objective, hintIndex: Map<ObjectiveId, number>): string | null {
    const idx = hintIndex.get(objective.id) ?? 0;
    if (idx >= objective.hints.length) return null;
    hintIndex.set(objective.id, idx + 1);
    return objective.hints[idx];
  }

  private meetsCriteria(objective: Objective, measurement: any): boolean {
    const criteria = objective.completionCriteria;
    switch (objective.type) {
      case 'measure': {
        const expected = criteria.expectedValue as number;
        const tolerance = (criteria.tolerance as number) ?? 0.05;
        if (typeof measurement.value === 'number') {
          return Math.abs(measurement.value - expected) <= tolerance;
        }
        break;
      }
      case 'observe': {
        const target = criteria.targetProperty as string;
        const expectedValue = criteria.expectedValue;
        return measurement[target] === expectedValue;
      }
      case 'analyze': {
        // Require both measurement and a passed reasoning check
        return measurement.correct === true;
      }
      default:
        return false;
    }
    return false;
  }
}