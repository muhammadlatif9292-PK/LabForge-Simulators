// worlds/electronics-world/electronics-world-bootstrap.ts
/**
 * Electronics World Bootstrap
 * 
 * Responsibilities:
 * - Create the electronics world descriptor with instruments and missions
 * - Instantiate the ElectronicsWorldRuntime
 */

import type { DomainWorldDescriptor } from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { ElectronicsWorldRuntime } from './electronics-world-runtime';

export async function bootstrapElectronicsWorld(
  logger: ILogger,
  meter: IMeter,
  eventBus: DistributedEventBus,
): Promise<ElectronicsWorldRuntime> {
  const descriptor: DomainWorldDescriptor = {
    id: 'world-electronics-lab-001' as any,
    domain: Domain.ELECTRONICS,
    version: '1.0.0',
    name: 'Circuit Analysis & Digital Logic Laboratory',
    requiredInstruments: ['multimeter', 'oscilloscope', 'voltmeter', 'ammeter'],
    defaultMissionIds: ['ohms-law', 'kirchhoff-laws', 'logic-gate-truth-table'],
    maxEntities: 1500,
    persistent: true,
    simulationConfig: {
      tickRateHz: 30,
      solverType: 'circuit',
      gpuAcceleration: false,
      maxSubSteps: 1,
    },
  };
  const runtime = new ElectronicsWorldRuntime(descriptor, logger, meter, eventBus);
  logger.info('Electronics world bootstrapped');
  return runtime;
}