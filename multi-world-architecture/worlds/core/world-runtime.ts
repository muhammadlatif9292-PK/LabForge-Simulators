// worlds/core/world-runtime.ts
/**
 * Core World Runtime
 * 
 * Responsibilities:
 * - Provide the base class for all domain worlds (chemistry, physics, etc.)
 * - Manage entity lifecycle, simulation ticking, and instrument binding
 * - Coordinate with streaming, memory, recovery, and mission subsystems
 * - Emit world events for observability
 * 
 * Owned state:
 * - entities: Map<WorldEntityId, WorldEntity>
 * - bindings: Map<InstrumentBindingId, InstrumentBinding>
 * - simulation: DomainSimulationRuntime (subclass)
 * - running: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DomainWorldDescriptor
 * - WorldStreamingRuntime
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * - MissionRuntime
 * - DomainSimulationRuntime
 * 
 * Event emissions: "world.entity.created", "world.entity.removed", "world.simulation.ticked"
 * Event subscriptions: none
 * Synchronization: per-world tick loop
 * Recovery: checkpoint/restore via save state
 * Telemetry: entity count, tick duration
 * Diagnostics: world health
 * Accessibility: N/A
 * Performance: tick loop bounded; entity updates batched
 * Forbidden: crashing world loop without recovery
 */

import type {
  DomainWorldDescriptor, WorldEntity, WorldEntityId,
  InstrumentBinding, InstrumentBindingId, WorldSaveState,
} from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export abstract class WorldRuntime {
  protected entities: Map<WorldEntityId, WorldEntity> = new Map();
  protected bindings: Map<InstrumentBindingId, InstrumentBinding> = new Map();
  protected running = false;
  protected tickTimer: any = null;
  protected currentTick = 0;

  constructor(
    public readonly descriptor: DomainWorldDescriptor,
    protected logger: ILogger,
    protected meter: IMeter,
    protected eventBus: DistributedEventBus,
  ) {}

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  addEntity(entity: WorldEntity): void {
    this.entities.set(entity.id, entity);
    this.eventBus.publish('world.entity.created', { worldId: this.descriptor.id, entity });
  }

  removeEntity(entityId: WorldEntityId): void {
    this.entities.delete(entityId);
    this.eventBus.publish('world.entity.removed', { worldId: this.descriptor.id, entityId });
  }

  bindInstrument(binding: InstrumentBinding): void {
    this.bindings.set(binding.id, binding);
  }

  unbindInstrument(bindingId: InstrumentBindingId): void {
    this.bindings.delete(bindingId);
  }

  abstract saveState(userId: string): Promise<WorldSaveState>;
  abstract restoreState(state: WorldSaveState): Promise<void>;
}