// worlds/physics-world/physics-world-bootstrap.ts
/**
 * Physics World Bootstrap
 * 
 * Responsibilities:
 * - Create the physics world descriptor with appropriate instruments and missions
 * - Instantiate and return the PhysicsWorldRuntime
 */

import type { DomainWorldDescriptor } from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { PhysicsWorldRuntime } from './physics-world-runtime';

export async function bootstrapPhysicsWorld(
  logger: ILogger,
  meter: IMeter,
  eventBus: DistributedEventBus,
): Promise<PhysicsWorldRuntime> {
  const descriptor: DomainWorldDescriptor = {
    id: 'world-physics-lab-001' as any,
    domain: Domain.PHYSICS,
    version: '1.0.0',
    name: 'Classical Mechanics Laboratory',
    requiredInstruments: ['oscilloscope', 'multimeter', 'laser', 'balance', 'voltmeter', 'ammeter'],
    defaultMissionIds: ['pendulum-period', 'ohms-law', 'lens-equation', 'newtons-second-law'],
    maxEntities: 1000,
    persistent: true,
    simulationConfig: {
      tickRateHz: 60,
      solverType: 'ode',
      gpuAcceleration: false,
      maxSubSteps: 8,
    },
  };
  const runtime = new PhysicsWorldRuntime(descriptor, logger, meter, eventBus);
  logger.info('Physics world bootstrapped');
  return runtime;
}