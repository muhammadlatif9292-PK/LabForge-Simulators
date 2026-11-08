// simulation-domains/chemistry/chemistry-simulation-runtime.ts
/**
 * Chemistry Simulation Runtime
 * 
 * Responsibilities:
 * - Concrete chemistry domain simulation: manage chemical substances, reactions, equilibrium
 * - Implement reaction kinetics (rate laws, Arrhenius equation)
 * - Simulate phase changes (solid/liquid/gas/aqueous)
 * - Calculate pH, concentration, equilibrium constants
 * - Integrate with chemistry-world instruments (beaker, burner, pipette)
 * 
 * Owned state: inherited from DomainSimulationRuntime + reactionRates, equilibriumCache
 * 
 * Dependencies:
 * - DomainSimulationRuntime base
 * - Chemistry-specific solver (ODE for kinetics)
 * - GPU compute for molecular dynamics (optional)
 * 
 * Event emissions:
 * - "chemistry.reaction.equilibrium.reached"
 * - "chemistry.phase.changed"
 * - "chemistry.pH.changed"
 * 
 * Event subscriptions: "instrument.measurement" (from pH meter, thermometer)
 * Synchronization: deterministic; all reactions resolved per tick
 * Recovery: standard checkpoint
 * Telemetry: reaction progress, equilibrium shifts
 * Diagnostics: active reactions table, species concentrations
 * Accessibility: chemical names and formulas exposed for screen readers
 * Performance: adaptive step for fast reactions; batch collision detection
 * Forbidden: violating stoichiometry; ignoring temperature effects on rate
 */

import type {
  DomainSimulationDescriptor,
  SubstanceState,
  ReactionDefinition,
} from '../contracts/domain-simulation-contracts';
import { SimulationDomain } from '../contracts/domain-simulation-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { DomainSimulationRuntime } from '../runtime/domain-simulation-runtime';
import type { SimulationSolver } from '../runtime/simulation-solver';
import type { GPUComputeRuntime } from '../runtime/GPU-compute-runtime';
import type { SimulationValidator } from '../runtime/simulation-validator';
import type { ScientificReplayEngine } from '../runtime/scientific-replay-engine';
import type { SimulationCheckpointRuntime } from '../runtime/simulation-checkpoint-runtime';

export class ChemistrySimulationRuntime extends DomainSimulationRuntime {
  private equilibriumStates: Map<string, boolean> = new Map(); // reactionId → atEquilibrium

  constructor(
    descriptor: DomainSimulationDescriptor,
    logger: ILogger,
    meter: IMeter,
    tracer: ITracer,
    eventBus: DistributedEventBus,
    solver: SimulationSolver,
    gpuRuntime: GPUComputeRuntime | null,
    validator: SimulationValidator,
    replayEngine: ScientificReplayEngine,
    checkpointRuntime: SimulationCheckpointRuntime,
  ) {
    super(descriptor, logger, meter, tracer, eventBus, solver, gpuRuntime, validator, replayEngine, checkpointRuntime);
  }

  get domainType(): SimulationDomain { return SimulationDomain.CHEMISTRY; }

  override async executeTick(): Promise<void> {
    // Pre-tick: check if any reactions should activate based on conditions
    for (const reaction of this.reactions) {
      if (!this.activeReactions.has(reaction.id) && this.shouldActivateReaction(reaction)) {
        await this.startReaction(reaction.id);
      }
    }
    await super.executeTick();

    // Post-tick: check for equilibrium
    for (const reactionId of this.activeReactions) {
      const atEquilibrium = this.checkEquilibrium(reactionId);
      if (atEquilibrium && !this.equilibriumStates.get(reactionId)) {
        this.equilibriumStates.set(reactionId, true);
        await this.eventBus.publish('chemistry.reaction.equilibrium.reached', {
          simulationId: this.descriptor.id,
          reactionId,
          tick: this.currentTick,
        });
      }
    }
  }

  protected shouldActivateReaction(reaction: ReactionDefinition): boolean {
    // Check conditions (temperature, pressure, catalyst)
    if (reaction.conditions?.minTemp !== undefined) {
      const reactantSubstances = reaction.reactants.map(r => this.substances.get(r.substanceId)).filter(Boolean);
      const avgTemp = reactantSubstances.reduce((s, sub) => s + (sub?.temperature ?? 0), 0) / (reactantSubstances.length || 1);
      if (avgTemp < reaction.conditions.minTemp) return false;
    }
    if (reaction.conditions?.maxTemp !== undefined) {
      const reactantSubstances = reaction.reactants.map(r => this.substances.get(r.substanceId)).filter(Boolean);
      const avgTemp = reactantSubstances.reduce((s, sub) => s + (sub?.temperature ?? 0), 0) / (reactantSubstances.length || 1);
      if (avgTemp > reaction.conditions.maxTemp) return false;
    }
    // Check minimum amounts
    for (const reactant of reaction.reactants) {
      const sub = this.substances.get(reactant.substanceId);
      if (!sub || sub.amount < 1e-6) return false;
    }
    return true;
  }

  private checkEquilibrium(reactionId: string): boolean {
    // Simplified: check if forward and reverse rates equal
    const reaction = this.reactions.find(r => r.id === reactionId);
    if (!reaction) return false;
    const reactantConcs = reaction.reactants.map(r => this.substances.get(r.substanceId)?.concentration ?? 0);
    const productConcs = reaction.products.map(p => this.substances.get(p.substanceId)?.concentration ?? 0);
    if (productConcs.every(c => c === 0)) return false; // no products yet
    // Compare rates (simplified)
    const forwardRate = reactantConcs.reduce((prod, c) => prod * Math.max(c, 1e-12), reaction.rateConstant);
    const reverseRate = productConcs.reduce((prod, c) => prod * Math.max(c, 1e-12), reaction.rateConstant * 0.01);
    const ratio = forwardRate / (reverseRate + 1e-12);
    return Math.abs(ratio - 1) < 0.05;
  }

  getpH(): number | null {
    // Find H+ concentration
    const hPlus = this.substances.get('H+' as any);
    if (!hPlus || hPlus.concentration === undefined) return null;
    return -Math.log10(Math.max(hPlus.concentration, 1e-14));
  }

  getTemperature(): number {
    // Average temperature of all substances
    const all = this.getSubstances();
    if (all.length === 0) return 298.15;
    return all.reduce((sum, s) => sum + s.temperature, 0) / all.length;
  }
}