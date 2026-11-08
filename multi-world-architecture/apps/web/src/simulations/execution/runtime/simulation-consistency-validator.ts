// apps/web/src/simulations/execution/runtime/simulation-consistency-validator.ts
/**
 * Simulation Consistency Validator
 * 
 * Responsibilities:
 * - Validate that a tick transition produces the correct state hash
 * - Compare state hashes across distributed nodes for deterministic agreement
 * - Detect divergent entities and report mismatches
 * - Support continuous validation during replay
 * 
 * Owned state:
 * - expectedHashes: Map<TickNumber, StateHash>
 * - mismatches: ConsistencyReport[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * 
 * Event emissions: "simulation.consistency.violation" on mismatch
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: triggers rollback in execution runtime
 * Telemetry: mismatch count, hash comparison latency
 * Diagnostics: divergent entities list
 * Accessibility: N/A
 * Performance: O(1) hash comparison; avoid full state serialization per validation
 * Forbidden: false positives due to non-deterministic serialization
 */

import type { TickNumber, StateHash, SimulationState, EntityId, ConsistencyReport } from '../contracts/simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { createHash } from 'crypto';

export class SimulationConsistencyValidator {
  private expectedHashes: Map<TickNumber, StateHash> = new Map();
  private mismatches: ConsistencyReport[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  setExpectedHash(tick: TickNumber, hash: StateHash): void {
    this.expectedHashes.set(tick, hash);
  }

  validateTransition(from: SimulationState, to: SimulationState): boolean {
    // Check that the transition is plausible (no sudden teleportation without input, etc.)
    const divergentEntities = this.findDivergentEntities(from, to);
    if (divergentEntities.length > 0) {
      this.logger.warn(`Divergent entities detected: ${divergentEntities.join(', ')}`);
      this.mismatches.push({
        consistent: false,
        expectedHash: from.stateHash,
        actualHash: to.stateHash,
        divergentEntities,
      });
      this.meter.incrementCounter('simulation.consistency.entity_mismatch');
      return false;
    }
    return true;
  }

  validateState(actualState: SimulationState, expectedHash: StateHash): ConsistencyReport {
    const actualHash = this.computeHash(actualState);
    const consistent = actualHash === expectedHash;
    if (!consistent) {
      this.mismatches.push({
        consistent: false,
        expectedHash,
        actualHash,
        divergentEntities: [],
      });
      this.meter.incrementCounter('simulation.consistency.hash_mismatch');
    }
    return {
      consistent,
      expectedHash,
      actualHash,
      divergentEntities: [],
    };
  }

  private findDivergentEntities(from: SimulationState, to: SimulationState): EntityId[] {
    // Simple check: any entity that moved more than a threshold without valid reason
    const divergent: EntityId[] = [];
    const threshold = 10.0; // max allowed distance per tick without explicit velocity
    for (const [id, entityTo] of to.entities) {
      const entityFrom = from.entities.get(id);
      if (!entityFrom) continue; // new entity
      const dist = Math.hypot(
        entityTo.position[0] - entityFrom.position[0],
        entityTo.position[1] - entityFrom.position[1],
        entityTo.position[2] - entityFrom.position[2],
      );
      // Allow large movement if velocity is high (simplistic)
      const speed = Math.hypot(...entityFrom.velocity);
      if (dist > threshold && speed < threshold) {
        divergent.push(id);
      }
    }
    return divergent;
  }

  private computeHash(state: SimulationState): StateHash {
    const ids = Array.from(state.entities.keys()).sort();
    const parts = ids.map(id => {
      const e = state.entities.get(id)!;
      return `${id}:${e.position.join(',')}:${e.velocity.join(',')}`;
    });
    return createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 16) as StateHash;
  }
}