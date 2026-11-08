// worlds/chemistry-world/chemistry-world-bootstrap.ts
/**
 * Chemistry World Bootstrap
 * 
 * Responsibilities:
 * - Load the chemistry world descriptor from the registry
 * - Initialize the chemistry world runtime with required instruments and missions
 * - Preload chemical substance data and reaction templates
 * - Warm up the simulation solver
 * - Coordinate with the app shell to present the world
 */

import type { DomainWorldDescriptor } from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { ChemistryWorldRuntime } from './chemistry-world-runtime';

export async function bootstrapChemistryWorld(
  logger: ILogger,
  meter: IMeter,
  eventBus: DistributedEventBus,
): Promise<ChemistryWorldRuntime> {
  const descriptor: DomainWorldDescriptor = {
    id: 'world-chem-lab-001' as any,
    domain: Domain.CHEMISTRY,
    version: '1.0.0',
    name: 'General Chemistry Laboratory',
    requiredInstruments: ['beaker', 'burner', 'spectrometer', 'balance', 'pipette'],
    defaultMissionIds: ['acid-base-titration', 'salt-synthesis'],
    maxEntities: 500,
    persistent: true,
    simulationConfig: {
      tickRateHz: 20,
      solverType: 'ode',
      gpuAcceleration: false,
      maxSubSteps: 4,
    },
  };
  const runtime = new ChemistryWorldRuntime(descriptor, logger, meter, eventBus);
  logger.info('Chemistry world bootstrapped');
  return runtime;
}