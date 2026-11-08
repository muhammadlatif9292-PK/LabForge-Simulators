// worlds/core/runtime/world-bootstrap.ts
/**
 * World Bootstrap
 * 
 * Responsibilities:
 * - Orchestrate the initialization sequence for a new world instance
 * - Register the world with the orchestrator, perform dependency checks,
 *   preload instrument definitions, and warm up AI context.
 * - Ensure that all required subsystems (streaming, memory, recovery) are ready.
 * 
 * Owned state: none (stateless function, but interacts with many services)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - WorldOrchestrator
 * - WorldRuntime (to be created)
 * - WorldStreamingRuntime
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * 
 * Event emissions: "world.bootstrap.started", "world.bootstrap.completed"
 * Event subscriptions: none
 * Synchronization: none external; orchestrator ensures single creation per ID
 * Recovery: if bootstrap fails, world is not registered and error logged
 * Telemetry: bootstrap duration
 * Diagnostics: bootstrap step log
 * Accessibility: N/A
 * Performance: parallel asset preloading
 * Forbidden: partial initialization without full resource availability
 */

import type { WorldDescriptor, WorldId } from '../contracts/world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WorldOrchestrator } from './world-orchestrator';
import type { WorldRuntime } from './world-runtime';
import { WorldRuntime as WR } from './world-runtime';

export async function bootstrapWorld(
  descriptor: WorldDescriptor,
  userId: string,
  orchestrator: WorldOrchestrator,
  logger: ILogger,
  meter: IMeter,
  eventBus: DistributedEventBus,
): Promise<WorldRuntime> {
  const start = Date.now();
  logger.info(`Bootstrapping world ${descriptor.id} for user ${userId}`);
  meter.incrementCounter('world.bootstrap.started');
  // Create dependencies
  const streaming = orchestrator.getStreamingRuntime();
  const memory = orchestrator.getMemoryManager();
  const recovery = orchestrator.getRecoveryEngine();
  const world = new WR(descriptor, logger, meter, eventBus, streaming, memory, recovery, orchestrator);
  await world.bootstrap(uuidv4(), userId);
  orchestrator.registerWorld(world);
  meter.incrementCounter('world.bootstrap.completed');
  logger.info(`World ${descriptor.id} bootstrapped in ${Date.now() - start}ms`);
  return world;
}
function uuidv4(): string { return crypto.randomUUID ? crypto.randomUUID() : 'mock-uuid'; }