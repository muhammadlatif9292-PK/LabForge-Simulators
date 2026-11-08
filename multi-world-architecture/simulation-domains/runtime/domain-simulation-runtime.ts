// simulation-domains/runtime/domain-simulation-runtime.ts
/**
 * Domain Simulation Runtime (Base)
 * 
 * Responsibilities:
 * - Execute a scientific domain simulation with deterministic tick loop
 * - Manage substance/reaction state lifecycle
 * - Coordinate solver execution (ODE, PDE, molecular)
 * - Emit state changes for rendering and AI consumption
 * - Validate conservation laws (energy, mass, charge)
 * 
 * Owned state:
 * - descriptor: DomainSimulationDescriptor
 * - substances: Map<SubstanceId, SubstanceState>
 * - reactions: ReactionDefinition[]
 * - activeReactions: Set<ReactionId>
 * - currentTick: number
 * - snapshots: SimulationSnapshot[]
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - SimulationSolver (domain-specific solver)
 * - GPUComputeRuntime (optional acceleration)
 * - SimulationValidator (conservation checks)
 * - ScientificReplayEngine
 * - SimulationCheckpointRuntime
 * 
 * Event emissions:
 * - "domain.simulation.tick.completed"
 * - "domain.simulation.reaction.started"
 * - "domain.simulation.reaction.completed"
 * - "domain.simulation.substance.changed"
 * - "domain.simulation.conservation.violation"
 * 
 * Event subscriptions:
 * - "world.entity.interaction" (to react to instrument use)
 * - "instrument.measurement.recorded" (to correlate with simulation)
 * 
 * Synchronization: deterministic tick loop; replay relies on same seed
 * Recovery: checkpoint restore + event replay
 * Telemetry: tick duration, reaction rate, entity count
 * Diagnostics: active reactions, substance states, solver convergence
 * Accessibility: substance data available in structured form for screen readers
 * Performance: GPU offloading for heavy computation; adaptive step size
 * Forbidden: non-deterministic random; modifying state outside tick; violating conservation laws silently
 */

import type {
  DomainSimulationDescriptor,
  DomainSimulationId,
  SubstanceState,
  ReactionDefinition,
  SimulationSnapshot,
  SubstanceId,
  ReactionId,
} from '../contracts/domain-simulation-contracts';
import { SimulationDomain } from '../contracts/domain-simulation-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { SimulationSolver } from './simulation-solver';
import type { GPUComputeRuntime } from './GPU-compute-runtime';
import type { SimulationValidator } from './simulation-validator';
import type { ScientificReplayEngine } from './scientific-replay-engine';
import type { SimulationCheckpointRuntime } from './simulation-checkpoint-runtime';
import { createHash } from 'crypto';

export abstract class DomainSimulationRuntime {
  protected substances: Map<SubstanceId, SubstanceState> = new Map();
  protected reactions: ReactionDefinition[] = [];
  protected activeReactions: Set<ReactionId> = new Set();
  protected currentTick = 0;
  protected snapshots: SimulationSnapshot[] = [];
  protected running = false;
  protected tickTimer: NodeJS.Timeout | null = null;
  protected readonly maxSnapshots = 500;

  constructor(
    public readonly descriptor: DomainSimulationDescriptor,
    protected logger: ILogger,
    protected meter: IMeter,
    protected tracer: ITracer,
    protected eventBus: DistributedEventBus,
    protected solver: SimulationSolver,
    protected gpuRuntime: GPUComputeRuntime | null,
    protected validator: SimulationValidator,
    protected replayEngine: ScientificReplayEngine,
    protected checkpointRuntime: SimulationCheckpointRuntime,
  ) {}

  async initialize(): Promise<void> {
    if (this.descriptor.initialSubstances) {
      for (const s of this.descriptor.initialSubstances) {
        this.substances.set(s.id, { ...s });
      }
    }
    await this.solver.initialize(this.descriptor.solverConfig);
    this.logger.info(`Domain simulation ${this.descriptor.id} (${this.descriptor.domain}) initialized`);
    this.meter.incrementCounter('domain.simulation.initialized', { domain: this.descriptor.domain });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const intervalMs = 1000 / this.descriptor.tickRateHz;
    this.tickTimer = setInterval(() => this.executeTick(), intervalMs);
    this.logger.info(`Domain simulation started at ${this.descriptor.tickRateHz} Hz`);
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    this.logger.info('Domain simulation stopped');
  }

  async executeTick(): Promise<void> {
    const span = this.tracer.startSpan('domain.simulation.tick', { simulationId: this.descriptor.id, tick: this.currentTick });
    const start = performance.now();
    this.currentTick++;

    // Run solver to advance state
    const updatedSubstances = await this.solver.step(
      Array.from(this.substances.values()),
      this.reactions.filter(r => this.activeReactions.has(r.id) || this.shouldActivateReaction(r)),
      this.descriptor.solverConfig.tolerance,
    );

    // Update local state
    for (const sub of updatedSubstances) {
      const prev = this.substances.get(sub.id);
      this.substances.set(sub.id, sub);
      if (prev && (prev.amount !== sub.amount || prev.temperature !== sub.temperature)) {
        await this.eventBus.publish('domain.simulation.substance.changed', {
          simulationId: this.descriptor.id,
          substanceId: sub.id,
          previous: prev,
          current: sub,
        });
      }
    }

    // Validate conservation
    const result = this.validator.validate(Array.from(this.substances.values()), this.reactions);
    if (!result.valid) {
      this.meter.incrementCounter('domain.simulation.conservation.violation');
      await this.eventBus.publish('domain.simulation.conservation.violation', {
        simulationId: this.descriptor.id,
        tick: this.currentTick,
        result,
      });
    }

    // Create snapshot periodically
    if (this.currentTick % 10 === 0) {
      const snapshot = this.createSnapshot();
      this.snapshots.push(snapshot);
      if (this.snapshots.length > this.maxSnapshots) this.snapshots.shift();
      await this.checkpointRuntime.saveSnapshot(this.descriptor.id, snapshot);
    }

    const duration = performance.now() - start;
    this.meter.recordHistogram('domain.simulation.tick.duration', duration, { domain: this.descriptor.domain });
    this.meter.incrementCounter('domain.simulation.tick.executed', { domain: this.descriptor.domain });
    span.setTag('duration_ms', duration);
    span.finish();

    await this.eventBus.publish('domain.simulation.tick.completed', {
      simulationId: this.descriptor.id,
      tick: this.currentTick,
      substanceCount: this.substances.size,
      activeReactions: this.activeReactions.size,
    });
  }

  async addSubstance(substance: SubstanceState): Promise<void> {
    this.substances.set(substance.id, substance);
    this.logger.debug(`Substance added: ${substance.name} (${substance.formula})`);
  }

  async removeSubstance(id: SubstanceId): Promise<void> {
    this.substances.delete(id);
  }

  async addReaction(reaction: ReactionDefinition): Promise<void> {
    this.reactions.push(reaction);
    this.logger.debug(`Reaction registered: ${reaction.id}`);
  }

  async startReaction(id: ReactionId): Promise<void> {
    const reaction = this.reactions.find(r => r.id === id);
    if (!reaction) throw new Error('Reaction not found');
    this.activeReactions.add(id);
    await this.eventBus.publish('domain.simulation.reaction.started', {
      simulationId: this.descriptor.id,
      reactionId: id,
      tick: this.currentTick,
    });
  }

  async stopReaction(id: ReactionId): Promise<void> {
    this.activeReactions.delete(id);
    await this.eventBus.publish('domain.simulation.reaction.completed', {
      simulationId: this.descriptor.id,
      reactionId: id,
      tick: this.currentTick,
    });
  }

  protected abstract shouldActivateReaction(reaction: ReactionDefinition): boolean;

  getSubstances(): SubstanceState[] { return Array.from(this.substances.values()); }

  getSnapshot(tick?: number): SimulationSnapshot | undefined {
    if (tick !== undefined) return this.snapshots.find(s => s.tick === tick);
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : undefined;
  }

  private createSnapshot(): SimulationSnapshot {
    const substances = Array.from(this.substances.values());
    const hashInput = substances.map(s => `${s.id}:${s.amount}:${s.temperature}`).join('|');
    const stateHash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
    return {
      simulationId: this.descriptor.id,
      tick: this.currentTick,
      timestamp: Date.now(),
      substances: substances.map(s => ({ ...s })),
      activeReactions: Array.from(this.activeReactions),
      stateHash,
    };
  }

  async shutdown(): Promise<void> {
    this.stop();
    await this.checkpointRuntime.saveSnapshot(this.descriptor.id, this.createSnapshot());
    this.substances.clear();
    this.reactions = [];
    this.snapshots = [];
  }
}