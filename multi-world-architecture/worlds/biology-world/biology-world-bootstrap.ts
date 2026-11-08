// worlds/biology-world/biology-world-bootstrap.ts
/**
 * Biology World Bootstrap
 * 
 * Responsibilities:
 * - Create the biology world descriptor with instruments and missions
 * - Instantiate the BiologyWorldRuntime
 */

import type { DomainWorldDescriptor } from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { BiologyWorldRuntime } from './biology-world-runtime';

export async function bootstrapBiologyWorld(
  logger: ILogger,
  meter: IMeter,
  eventBus: DistributedEventBus,
): Promise<BiologyWorldRuntime> {
  const descriptor: DomainWorldDescriptor = {
    id: 'world-biology-lab-001' as any,
    domain: Domain.BIOLOGY,
    version: '1.0.0',
    name: 'Ecosystem & Cellular Biology Laboratory',
    requiredInstruments: ['microscope', 'centrifuge', 'pipette'],
    defaultMissionIds: ['cell-division-observation', 'ecosystem-analysis'],
    maxEntities: 2000,
    persistent: true,
    simulationConfig: {
      tickRateHz: 1, // 1 tick per second = 1 in-game hour
      solverType: 'statistical',
      gpuAcceleration: false,
      maxSubSteps: 1,
    },
  };
  const runtime = new BiologyWorldRuntime(descriptor, logger, meter, eventBus);
  logger.info('Biology world bootstrapped');
  return runtime;
}