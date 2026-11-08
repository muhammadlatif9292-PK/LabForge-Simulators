// instrumentation-core/runtime/instrument-simulation.ts
/**
 * Instrument Simulation
 * 
 * Responsibilities:
 * - Bridge between instrument actions and the world simulation state
 * - Compute physical interactions (e.g., beaker heating, centrifuge spinning)
 * - Generate realistic measurement values based on simulation properties
 * - Support deterministic replay of instrument-coupled simulations
 * 
 * Owned state:
 * - simulationBindings: Map<InstrumentId, SimulationBinding>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DeterministicExecutionRuntime (or simulation engine)
 * - PhysicsStepRuntime
 * - GPU-simulation-runtime (optional)
 * 
 * Event emissions: "instrument.simulation.updated"
 * Event subscriptions: "simulation.tick.completed" to update instrument state
 * Synchronization: reads simulation state; writes are buffered as interactions
 * Recovery: re-bind to simulation after checkpoint restore
 * Telemetry: simulation coupling latency
 * Diagnostics: binding state
 * Accessibility: N/A
 * Performance: light coupling; avoid per-frame computations for idle instruments
 * Forbidden: mutating simulation directly without transaction; breaking determinism
 */

import type { InstrumentDescriptor, InstrumentMeasurement } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface SimulationBinding {
  worldEntityId: string;
  lastValue: number;
}

export class InstrumentSimulation {
  private bindings: Map<string, SimulationBinding> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  bindToEntity(instrumentId: string, worldEntityId: string): void {
    this.bindings.set(instrumentId, { worldEntityId, lastValue: 0 });
    this.logger.debug(`Instrument ${instrumentId} bound to entity ${worldEntityId}`);
  }

  getCurrentValue(instrumentId: string): number {
    const binding = this.bindings.get(instrumentId);
    if (!binding) return 0;
    // Read from simulation state (simplified: return last known)
    return binding.lastValue;
  }

  unbind(instrumentId: string): void {
    this.bindings.delete(instrumentId);
  }
}