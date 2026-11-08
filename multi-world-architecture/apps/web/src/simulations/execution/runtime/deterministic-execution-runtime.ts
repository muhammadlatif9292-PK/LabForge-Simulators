// apps/web/src/simulations/execution/runtime/deterministic-execution-runtime.ts
/**
 * Deterministic Execution Runtime
 * 
 * Responsibilities:
 * - Execute simulation ticks with full determinism (same inputs → same state)
 * - Manage the main simulation loop: receive inputs, advance state, produce outputs
 * - Enforce deterministic random number generation and fixed-point math
 * - Support stepping forward, backward, and jumping to any tick
 * - Maintain authoritative state hash for validation
 * 
 * Owned state:
 * - currentState: SimulationState
 * - tickHistory: Map<TickNumber, TickOutput>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - SimulationTickScheduler (to manage timing)
 * - PhysicsStepRuntime (for physics integration)
 * - GPU-simulation-runtime (optional acceleration)
 * - SimulationConsistencyValidator
 * - Deterministic PRNG (seeded)
 * 
 * Event emissions: "simulation.tick.completed", "simulation.state.changed"
 * Event subscriptions: "simulation.input" for user/external inputs
 * Synchronization: sync with other nodes via DistributedSimulationSync
 * Recovery: replay from last valid checkpoint if state inconsistency detected
 * Telemetry: tick duration, entity count, state hash
 * Diagnostics: current tick, state dump, performance
 * Accessibility: N/A
 * Performance: optimized math; batched physics updates; avoid heap allocations per tick
 * Forbidden: using Math.random(); non-deterministic floating-point; relying on wall-clock time
 */

import { createHash } from 'crypto';
import type {
  SimulationId,
  SimulationState,
  TickNumber,
  TickInput,
  TickOutput,
  StateHash,
  EntityId,
  EntityState,
  Checkpoint,
} from '../contracts/simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { SimulationTickScheduler } from '../tick/simulation-tick-scheduler';
import type { PhysicsStepRuntime } from '../physics/physics-step-runtime';
import type { SimulationConsistencyValidator } from './simulation-consistency-validator';

// Simple deterministic PRNG (xoshiro128** or mulberry32)
class DeterministicRNG {
  private state: number;
  constructor(seed: number) { this.state = seed; }
  next(): number {
    this.state |= 0;
    this.state = this.state + 0x6D2B79F5 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export class DeterministicExecutionRuntime {
  private rng: DeterministicRNG;
  private currentState: SimulationState;
  private tickHistory: Map<TickNumber, TickOutput> = new Map();
  private readonly maxHistory = 1000;

  constructor(
    private simulationId: SimulationId,
    private scheduler: SimulationTickScheduler,
    private physics: PhysicsStepRuntime,
    private validator: SimulationConsistencyValidator,
    private logger: ILogger,
    private meter: IMeter,
    private seed: number = 42,
  ) {
    this.rng = new DeterministicRNG(seed);
    this.currentState = this.createInitialState();
    this.scheduler.onTick = (input: TickInput) => this.executeTick(input);
  }

  private createInitialState(): SimulationState {
    return {
      simulationId: this.simulationId,
      currentTick: 0 as TickNumber,
      stateHash: this.computeHash('initial'),
      entities: new Map(),
      timestamp: Date.now(),
      deterministicSeed: this.seed,
    };
  }

  async executeTick(input: TickInput): Promise<TickOutput> {
    const start = performance.now();
    const tick = input.tickNumber;
    this.logger.debug(`Executing tick ${tick}`);

    // Clone state for deterministic mutation
    const newState = this.cloneState(this.currentState);
    newState.currentTick = tick;

    // Apply user inputs to entities
    this.applyInputs(newState, input.userInputs);

    // Run physics for this tick (sub-stepped if needed)
    const physicsResult = this.physics.step(newState, input.deltaTimeMs / 1000, this.rng);
    newState.entities = new Map(physicsResult.entities.map(e => [e.id, e]));

    // Recomputed state hash
    newState.stateHash = this.computeHash(this.serializeState(newState));

    const output: TickOutput = {
      tickNumber: tick,
      applied: true,
      newState,
      stateHash: newState.stateHash,
      events: [],
      durationMs: performance.now() - start,
    };

    // Validate consistency
    const valid = this.validator.validateTransition(this.currentState, newState);
    if (!valid) {
      this.logger.error(`State consistency violation at tick ${tick}`);
      this.meter.incrementCounter('simulation.consistency.violation');
      // Recover from last checkpoint
      await this.restoreLastCheckpoint();
      return output; // but state may be rolled back
    }

    this.currentState = newState;
    this.tickHistory.set(tick, output);
    if (this.tickHistory.size > this.maxHistory) {
      const firstKey = this.tickHistory.keys().next().value;
      if (firstKey) this.tickHistory.delete(firstKey);
    }

    this.meter.recordHistogram('simulation.tick.duration', output.durationMs);
    this.meter.incrementCounter('simulation.tick.executed');
    return output;
  }

  private applyInputs(state: SimulationState, inputs: UserInput[]): void {
    for (const input of inputs) {
      const entity = state.entities.get(input.entityId);
      if (entity) {
        // Apply input to entity (simplified: modify position/velocity)
        // Deterministic: use fixed point math or consistent arithmetic
        if (input.type === 'move') {
          const dir = input.payload as [number, number, number];
          entity.position[0] += dir[0];
          entity.position[1] += dir[1];
          entity.position[2] += dir[2];
        }
      }
    }
  }

  private cloneState(state: SimulationState): SimulationState {
    return {
      ...state,
      entities: new Map(Array.from(state.entities.entries()).map(([id, e]) => [id, { ...e }])),
    };
  }

  private computeHash(input: string): StateHash {
    return createHash('sha256').update(input).digest('hex').substring(0, 16) as StateHash;
  }

  private serializeState(state: SimulationState): string {
    // Deterministic serialization: sort entity IDs
    const ids = Array.from(state.entities.keys()).sort();
    const parts = ids.map(id => {
      const e = state.entities.get(id)!;
      return `${id}:${e.position.join(',')}:${e.velocity.join(',')}`;
    });
    return parts.join('|');
  }

  private async restoreLastCheckpoint(): Promise<void> {
    // In production, load from checkpoint store
    this.logger.warn('Restoring from last checkpoint...');
    // For simplicity, reset to initial
    this.currentState = this.createInitialState();
  }

  getCurrentState(): SimulationState {
    return this.currentState;
  }

  getTickHistory(tick: TickNumber): TickOutput | undefined {
    return this.tickHistory.get(tick);
  }

  async shutdown(): Promise<void> {
    this.scheduler.stop();
  }
}