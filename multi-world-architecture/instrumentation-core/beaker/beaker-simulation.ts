// instrumentation-core/beaker/beaker-simulation.ts
/**
 * Beaker Simulation Bridge
 * 
 * Responsibilities:
 * - Couple the beaker contents with the chemistry domain simulation
 * - Compute heating rate based on heat source temperature and contents volume
 * - Detect phase changes and emit observations
 * - Provide deterministic reaction outcomes for replay
 * 
 * Owned state:
 * - heatTransferCoefficient: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - ChemistryODESolver (for reaction kinetics)
 * - ChemistrySimulationRuntime (to register substances)
 * 
 * Event emissions: "beaker.reaction.observed"
 * Event subscriptions: "chemistry.tick.completed"
 * Synchronization: updates after each chemistry tick
 * Recovery: re-sync with simulation after restore
 * Telemetry: reaction events
 * Diagnostics: current reaction status
 * Accessibility: N/A
 * Performance: lightweight ODE step only when contents non-empty
 * Forbidden: simulating without validated reaction data
 */

import type { BeakerContents } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class BeakerSimulation {
  private heatTransferCoefficient = 0.02; // K per second per K difference

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  computeHeating(contents: BeakerContents, isHeating: boolean, heatSourceTemp: number, dt: number): number {
    if (!isHeating || contents.substances.length === 0) {
      return contents.substances[0]?.temperature ?? 298;
    }
    const currentTemp = contents.substances[0].temperature;
    const deltaT = heatSourceTemp - currentTemp;
    const newTemp = currentTemp + deltaT * this.heatTransferCoefficient * dt;
    return Math.min(newTemp, heatSourceTemp);
  }

  detectPhaseChange(temperature: number, substanceName: string): string | null {
    if (substanceName === 'Water') {
      if (temperature >= 373 && temperature < 374) return 'boiling';
      if (temperature <= 273 && temperature > 272) return 'freezing';
    }
    return null;
  }
}