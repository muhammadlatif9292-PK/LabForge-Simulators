// worlds/chemistry-world/chemistry-world-runtime.ts
/**
 * Chemistry World Runtime
 * 
 * Responsibilities:
 * - Execute the chemistry domain simulation loop
 * - Manage chemical entities (beakers, reagents, products)
 * - Coordinate with chemistry instruments (beaker, burner, spectrometer, balance, pipette)
 * - Run chemistry missions (titration, synthesis, analysis)
 * - Persist world state for offline replay
 * 
 * Owned state: inherited from WorldRuntime
 * 
 * Dependencies:
 * - ChemistrySimulationRuntime (domain simulation)
 * - WorldStreamingRuntime
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * - MissionRuntime
 * 
 * Event emissions: "chemistry.reaction.occurred", "chemistry.substance.changed"
 * Event subscriptions: "instrument.measurement.recorded" in this world
 */

import { v4 as uuidv4 } from 'uuid';
import type { DomainWorldDescriptor, WorldEntity, WorldSaveState } from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { WorldRuntime } from '../core/world-runtime';

export class ChemistryWorldRuntime extends WorldRuntime {
  private domainSimulation: any; // ChemistrySimulationRuntime

  constructor(
    descriptor: DomainWorldDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
  ) {
    super(descriptor, logger, meter, eventBus);
    if (descriptor.domain !== Domain.CHEMISTRY) {
      throw new Error('ChemistryWorldRuntime requires CHEMISTRY domain descriptor');
    }
  }

  async start(): Promise<void> {
    this.running = true;
    const intervalMs = 1000 / this.descriptor.simulationConfig.tickRateHz;
    this.tickTimer = setInterval(() => this.tick(), intervalMs);
    this.logger.info(`Chemistry world started: ${this.descriptor.name}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    this.logger.info(`Chemistry world stopped: ${this.descriptor.name}`);
  }

  private tick(): void {
    if (!this.running) return;
    this.currentTick++;
    // Domain simulation step handled by injected simulation runtime
    this.eventBus.publish('world.simulation.ticked', {
      worldId: this.descriptor.id,
      tick: this.currentTick,
    });
  }

  async addChemicalEntity(type: string, position: [number, number, number], properties: Record<string, unknown>): Promise<WorldEntity> {
    const entity: WorldEntity = {
      id: uuidv4() as any,
      type,
      position,
      rotation: [0, 0, 0, 1],
      properties,
      instrumentBindings: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.addEntity(entity);
    return entity;
  }

  async saveState(userId: string): Promise<WorldSaveState> {
    const state: WorldSaveState = {
      worldId: this.descriptor.id,
      userId,
      timestamp: Date.now(),
      entities: Array.from(this.entities.values()),
      instrumentBindings: Array.from(this.bindings.values()),
      simulationSnapshot: null,
      missionProgress: {},
      checksum: '',
    };
    const json = JSON.stringify(state);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    state.checksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return state;
  }

  async restoreState(state: WorldSaveState): Promise<void> {
    this.entities.clear();
    this.bindings.clear();
    for (const entity of state.entities) {
      this.entities.set(entity.id, entity);
    }
    for (const binding of state.instrumentBindings) {
      this.bindings.set(binding.id, binding);
    }
    this.logger.info(`Chemistry world state restored (${state.entities.length} entities)`);
  }
}