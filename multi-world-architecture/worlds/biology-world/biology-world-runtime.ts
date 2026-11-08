// worlds/biology-world/biology-world-runtime.ts
/**
 * Biology World Runtime
 * 
 * Responsibilities:
 * - Execute the biology domain simulation loop (ecosystems, cellular biology, genetics)
 * - Manage biological entities (organisms, cells, DNA strands, ecosystems)
 * - Coordinate with biology instruments (microscope, centrifuge, pipette, incubator)
 * - Run biology missions (cell division observation, DNA extraction, ecosystem analysis)
 * - Persist world state for offline replay
 * 
 * Owned state: inherited from WorldRuntime
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - BiologySimulationRuntime (domain simulation)
 * - WorldStreamingRuntime
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * - MissionRuntime
 * 
 * Event emissions:
 *   "biology.organism.reproduced", "biology.cell.divided"
 *   "biology.ecosystem.changed", "biology.dna.sequenced"
 * 
 * Event subscriptions:
 *   "instrument.measurement.recorded" (microscope observations)
 *   "world.time.advanced" (day/night cycle for ecosystem)
 * 
 * Synchronization: single-threaded tick loop; time-based simulation
 * Recovery: world state persisted to snapshot
 * Telemetry: organism count, species diversity, tick duration
 * Diagnostics: ecosystem health, population graph
 * Accessibility: specimen descriptions for screen readers
 * Performance: agent-based simulation optimised; spatial partitioning
 * Forbidden: simulating without respecting biological constraints; unlimited growth
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DomainWorldDescriptor, WorldEntity, WorldEntityId,
  InstrumentBinding, InstrumentBindingId, WorldSaveState,
} from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { WorldRuntime } from '../core/world-runtime';

export class BiologyWorldRuntime extends WorldRuntime {
  private ecosystemData: Map<string, SpeciesStats> = new Map();
  private worldTime = 0; // in-game hours
  private environmentalConditions: EnvironmentalConditions = {
    temperature: 25,    // °C
    humidity: 0.6,      // 0-1
    lightLevel: 1,      // 0-1 (daytime)
    pH: 7,
    nutrientLevel: 0.8,
  };

  constructor(
    descriptor: DomainWorldDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
  ) {
    super(descriptor, logger, meter, eventBus);
    if (descriptor.domain !== Domain.BIOLOGY) {
      throw new Error('BiologyWorldRuntime requires BIOLOGY domain descriptor');
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const intervalMs = 1000 / this.descriptor.simulationConfig.tickRateHz;
    this.tickTimer = setInterval(() => this.tick(), intervalMs);
    this.meter.incrementCounter('biology.world.started');
    this.logger.info(`Biology world started: ${this.descriptor.name}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.meter.incrementCounter('biology.world.stopped');
    this.logger.info(`Biology world stopped: ${this.descriptor.name}`);
  }

  private tick(): void {
    if (!this.running) return;
    this.currentTick++;
    const start = performance.now();

    // Advance in-game time (1 tick = 1 hour for ecosystem, configurable)
    this.worldTime += 1;
    this.updateEnvironmentalConditions();

    // Process each biological entity
    for (const entity of this.entities.values()) {
      this.processOrganismTick(entity);
      this.processCellTick(entity);
    }

    // Update ecosystem statistics
    this.updateEcosystemStats();

    const duration = performance.now() - start;
    this.meter.recordHistogram('biology.world.tick.duration', duration, { entityCount: this.entities.size });
    this.eventBus.publish('world.simulation.ticked', {
      worldId: this.descriptor.id,
      tick: this.currentTick,
      inGameHour: this.worldTime % 24,
    });
  }

  private updateEnvironmentalConditions(): void {
    const dayHour = this.worldTime % 24;
    // Diurnal light cycle
    this.environmentalConditions.lightLevel = Math.max(0, Math.sin((dayHour - 6) * Math.PI / 12));
    // Temperature slightly cooler at night
    this.environmentalConditions.temperature = 25 + 5 * Math.sin((dayHour - 12) * Math.PI / 12);
  }

  private processOrganismTick(entity: WorldEntity): void {
    if (entity.type !== 'organism') return;
    const energy = (entity.properties.energy as number) ?? 10;
    const metabolismRate = (entity.properties.metabolismRate as number) ?? 0.1;
    const reproductiveThreshold = (entity.properties.reproductiveThreshold as number) ?? 20;

    // Consume energy based on metabolism
    let newEnergy = energy - metabolismRate * (1 - this.environmentalConditions.nutrientLevel * 0.5);
    newEnergy = Math.max(0, newEnergy);
    entity.properties.energy = newEnergy;

    // Reproduction when energy exceeds threshold
    if (newEnergy >= reproductiveThreshold) {
      entity.properties.energy = newEnergy / 2;
      this.eventBus.publish('biology.organism.reproduced', {
        parentId: entity.id,
        species: entity.properties.species ?? 'unknown',
        worldTime: this.worldTime,
      });
    }

    // Death if energy depleted
    if (newEnergy <= 0) {
      this.removeEntity(entity.id);
      this.eventBus.publish('biology.organism.died', { entityId: entity.id, cause: 'starvation' });
    }

    entity.updatedAt = Date.now();
  }

  private processCellTick(entity: WorldEntity): void {
    if (entity.type !== 'cell') return;
    const divisionTimer = (entity.properties.divisionTimer as number) ?? 0;
    const divisionInterval = (entity.properties.divisionInterval as number) ?? 12; // hours

    // Count down to division
    const newTimer = divisionTimer + 1;
    entity.properties.divisionTimer = newTimer;

    if (newTimer >= divisionInterval) {
      entity.properties.divisionTimer = 0;
      this.eventBus.publish('biology.cell.divided', { parentCellId: entity.id, worldTime: this.worldTime });
    }
    entity.updatedAt = Date.now();
  }

  private updateEcosystemStats(): void {
    const speciesMap = new Map<string, { count: number; totalEnergy: number }>();
    for (const entity of this.entities.values()) {
      if (entity.type !== 'organism') continue;
      const species = (entity.properties.species as string) ?? 'unknown';
      const energy = (entity.properties.energy as number) ?? 0;
      if (!speciesMap.has(species)) {
        speciesMap.set(species, { count: 0, totalEnergy: 0 });
      }
      const stats = speciesMap.get(species)!;
      stats.count++;
      stats.totalEnergy += energy;
    }
    for (const [species, stats] of speciesMap) {
      this.ecosystemData.set(species, {
        species,
        population: stats.count,
        averageEnergy: stats.totalEnergy / Math.max(1, stats.count),
        lastUpdated: this.worldTime,
      });
    }
    if (speciesMap.size > 0) {
      this.eventBus.publish('biology.ecosystem.changed', {
        worldId: this.descriptor.id,
        speciesCount: speciesMap.size,
        totalPopulation: Array.from(speciesMap.values()).reduce((s, v) => s + v.count, 0),
      });
    }
  }

  async addOrganism(
    species: string,
    position: [number, number, number],
    options?: Partial<OrganismOptions>,
  ): Promise<WorldEntity> {
    const entity: WorldEntity = {
      id: uuidv4() as WorldEntityId,
      type: 'organism',
      position,
      rotation: [0, 0, 0, 1],
      properties: {
        species,
        energy: options?.energy ?? 15,
        metabolismRate: options?.metabolismRate ?? 0.1,
        reproductiveThreshold: options?.reproductiveThreshold ?? 20,
        size: options?.size ?? 1,
        color: options?.color ?? [100, 200, 100],
      },
      instrumentBindings: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.addEntity(entity);
    return entity;
  }

  getEcosystemData(): SpeciesStats[] {
    return Array.from(this.ecosystemData.values());
  }

  getEnvironmentalConditions(): Readonly<EnvironmentalConditions> {
    return { ...this.environmentalConditions };
  }

  getWorldTime(): number {
    return this.worldTime;
  }

  async saveState(userId: string): Promise<WorldSaveState> {
    const state: WorldSaveState = {
      worldId: this.descriptor.id,
      userId,
      timestamp: Date.now(),
      entities: Array.from(this.entities.values()),
      instrumentBindings: Array.from(this.bindings.values()),
      simulationSnapshot: {
        worldTime: this.worldTime,
        environmentalConditions: this.environmentalConditions,
        ecosystemData: Array.from(this.ecosystemData.entries()),
      },
      missionProgress: {},
      checksum: '',
    };
    const json = JSON.stringify(state);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    state.checksum = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return state;
  }

  async restoreState(state: WorldSaveState): Promise<void> {
    this.entities.clear();
    this.bindings.clear();
    this.ecosystemData.clear();
    for (const entity of state.entities) {
      this.entities.set(entity.id, entity);
    }
    for (const binding of state.instrumentBindings) {
      this.bindings.set(binding.id, binding);
    }
    if (state.simulationSnapshot) {
      const snap = state.simulationSnapshot as any;
      this.worldTime = snap.worldTime ?? 0;
      if (snap.environmentalConditions) {
        this.environmentalConditions = snap.environmentalConditions;
      }
      if (snap.ecosystemData) {
        for (const [species, data] of snap.ecosystemData) {
          this.ecosystemData.set(species, data);
        }
      }
    }
    this.logger.info(`Biology world state restored (${state.entities.length} entities, ${this.ecosystemData.size} species)`);
  }
}

// Supporting types
interface SpeciesStats {
  species: string;
  population: number;
  averageEnergy: number;
  lastUpdated: number;
}

interface EnvironmentalConditions {
  temperature: number;
  humidity: number;
  lightLevel: number;
  pH: number;
  nutrientLevel: number;
}

interface OrganismOptions {
  energy: number;
  metabolismRate: number;
  reproductiveThreshold: number;
  size: number;
  color: [number, number, number];
}