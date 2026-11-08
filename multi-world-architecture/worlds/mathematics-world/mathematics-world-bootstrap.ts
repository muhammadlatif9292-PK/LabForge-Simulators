// worlds/mathematics-world/mathematics-world-bootstrap.ts
/**
 * Mathematics World Bootstrap
 * 
 * Responsibilities:
 * - Create the mathematics world descriptor with appropriate tools and missions
 * - Instantiate the MathematicsWorldRuntime
 */

import type { DomainWorldDescriptor } from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { MathematicsWorldRuntime } from './mathematics-world-runtime';

export async function bootstrapMathematicsWorld(
  logger: ILogger,
  meter: IMeter,
  eventBus: DistributedEventBus,
): Promise<MathematicsWorldRuntime> {
  const descriptor: DomainWorldDescriptor = {
    id: 'world-mathematics-lab-001' as any,
    domain: Domain.MATHEMATICS,
    version: '1.0.0',
    name: 'Mathematics Exploration Laboratory',
    requiredInstruments: [], // Mathematics uses virtual graphing tools
    defaultMissionIds: ['derivative-exploration', 'geometric-proofs', 'statistical-analysis'],
    maxEntities: 500,
    persistent: true,
    simulationConfig: {
      tickRateHz: 1,
      solverType: 'statistical',
      gpuAcceleration: false,
      maxSubSteps: 1,
    },
  };
  const runtime = new MathematicsWorldRuntime(descriptor, logger, meter, eventBus);
  logger.info('Mathematics world bootstrapped');
  return runtime;
}