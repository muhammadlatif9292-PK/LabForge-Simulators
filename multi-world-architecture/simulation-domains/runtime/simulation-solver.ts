// simulation-domains/runtime/simulation-solver.ts
/**
 * Simulation Solver (Base)
 * 
 * Responsibilities:
 * - Numerically integrate the system state for one time step
 * - Implement ODE solver (Runge-Kutta 4/5, adaptive) as default
 * - Support domain-specific solver overrides
 * - Ensure deterministic computation (same inputs → same outputs)
 * - Report solver convergence statistics
 * 
 * Owned state: none (stateless, receives state each step)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none (pure function)
 * Recovery: n/a
 * Telemetry: step iterations, convergence rate
 * Diagnostics: solver type, last error
 * Accessibility: N/A
 * Performance: optimized math; avoid allocations per call
 * Forbidden: non-deterministic operations; exceeding max iterations without reporting
 */

import type { SolverConfig, SubstanceState, ReactionDefinition } from '../contracts/domain-simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export interface SolverStepResult {
  substances: SubstanceState[];
  iterations: number;
  converged: boolean;
  error: number;
}

export abstract class SimulationSolver {
  protected config: SolverConfig | null = null;

  constructor(
    protected logger: ILogger,
    protected meter: IMeter,
  ) {}

  async initialize(config: SolverConfig): Promise<void> {
    this.config = config;
    this.logger.debug(`Solver initialized: ${config.type} (tolerance=${config.tolerance})`);
  }

  abstract step(
    substances: SubstanceState[],
    activeReactions: ReactionDefinition[],
    tolerance: number,
  ): Promise<SubstanceState[]>;

  protected clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}