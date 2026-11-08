// worlds/physics-world/physics-world-runtime.ts
/**
 * Physics World Runtime
 * 
 * Responsibilities:
 * - Execute the physics domain simulation loop (classical mechanics, optics, electromagnetism)
 * - Manage physics entities (masses, springs, pendulums, circuits, lenses)
 * - Coordinate with physics instruments (oscilloscope, multimeter, laser, balance, voltmeter, ammeter)
 * - Run physics missions (pendulum period, Ohm's law, lens equation)
 * - Persist world state for offline replay and deterministic restoration
 * 
 * Owned state: inherited from WorldRuntime
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - PhysicsSimulationRuntime (domain simulation)
 * - WorldStreamingRuntime
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * - MissionRuntime
 * 
 * Event emissions:
 *   "physics.collision.occurred", "physics.measurement.recorded"
 *   "physics.circuit.state_changed", "physics.field.updated"
 * 
 * Event subscriptions:
 *   "instrument.measurement.recorded" (within this world)
 *   "world.entity.interaction" (user manipulation of entities)
 * 
 * Synchronization: single-threaded tick loop; deterministic execution
 * Recovery: world state saved/restored via WorldSaveState snapshots
 * Telemetry: entity count, tick duration, collision events per tick
 * Diagnostics: entity list, active simulation constraints
 * Accessibility: entity descriptions and measurements exposed for screen readers
 * Performance: broad-phase collision detection; spatial hash for large scenes
 * Forbidden: non-deterministic physics; ignoring conservation laws; entities leaving bounds
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

export class PhysicsWorldRuntime extends WorldRuntime {
  private domainSimulation: any; // PhysicsSimulationRuntime (mechanics, EM, optics)
  private constraintRegistry: Map<string, PhysicsConstraint> = new Map();
  private spatialHash: Map<string, WorldEntityId[]> = new Map(); // grid cell → entity IDs
  private readonly GRAVITY = -9.81; // m/s²

  constructor(
    descriptor: DomainWorldDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
  ) {
    super(descriptor, logger, meter, eventBus);
    if (descriptor.domain !== Domain.PHYSICS) {
      throw new Error('PhysicsWorldRuntime requires PHYSICS domain descriptor');
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const intervalMs = 1000 / this.descriptor.simulationConfig.tickRateHz;
    this.tickTimer = setInterval(() => this.tick(), intervalMs);
    this.meter.incrementCounter('physics.world.started');
    this.logger.info(`Physics world started: ${this.descriptor.name}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.meter.incrementCounter('physics.world.stopped');
    this.logger.info(`Physics world stopped: ${this.descriptor.name}`);
  }

  private tick(): void {
    if (!this.running) return;
    this.currentTick++;
    const start = performance.now();

    // 1. Integrate physics for all dynamic entities
    this.integratePhysics();

    // 2. Detect and resolve collisions
    const collisions = this.detectCollisions();
    this.resolveCollisions(collisions);

    // 3. Enforce constraints (springs, rods, pivots)
    this.enforceConstraints();

    // 4. Update spatial hash for next frame
    this.rebuildSpatialHash();

    const duration = performance.now() - start;
    this.meter.recordHistogram('physics.world.tick.duration', duration, { entityCount: this.entities.size });
    this.meter.recordHistogram('physics.world.collision.count', collisions.length);
    this.eventBus.publish('world.simulation.ticked', {
      worldId: this.descriptor.id,
      tick: this.currentTick,
      entityCount: this.entities.size,
      collisionCount: collisions.length,
    });
  }

  private integratePhysics(): void {
    const dt = 1 / this.descriptor.simulationConfig.tickRateHz;
    for (const entity of this.entities.values()) {
      // Skip static entities
      if (entity.properties.static === true) continue;

      // Simple Euler integration for position/velocity
      const pos = entity.position;
      const vel = (entity.properties.velocity as [number, number, number]) ?? [0, 0, 0];
      const mass = (entity.properties.mass as number) ?? 1;

      // Apply forces from entity properties
      const force = (entity.properties.force as [number, number, number]) ?? [0, 0, 0];
      const totalForce: [number, number, number] = [
        force[0],
        force[1] + (entity.properties.affectedByGravity ? this.GRAVITY * mass : 0),
        force[2],
      ];

      // Acceleration = F / m
      const acc: [number, number, number] = [
        totalForce[0] / mass,
        totalForce[1] / mass,
        totalForce[2] / mass,
      ];

      // New velocity
      const newVel: [number, number, number] = [
        vel[0] + acc[0] * dt,
        vel[1] + acc[1] * dt,
        vel[2] + acc[2] * dt,
      ];

      // New position
      const newPos: [number, number, number] = [
        pos[0] + newVel[0] * dt,
        pos[1] + newVel[1] * dt,
        pos[2] + newVel[2] * dt,
      ];

      entity.position = newPos;
      entity.properties.velocity = newVel;
      entity.updatedAt = Date.now();
    }
  }

  private detectCollisions(): CollisionPair[] {
    const pairs: CollisionPair[] = [];
    const checkedPairs = new Set<string>();
    const entityList = Array.from(this.entities.values());

    // Broad-phase: only check entities in the same spatial hash cell
    for (let i = 0; i < entityList.length; i++) {
      const a = entityList[i];
      const cellKey = this.getCellKey(a.position);
      const neighbors = this.spatialHash.get(cellKey) ?? [];
      for (const neighborId of neighbors) {
        if (neighborId === a.id) continue;
        const pairKey = [a.id, neighborId].sort().join('|');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);
        const b = this.entities.get(neighborId);
        if (!b) continue;
        const distance = Math.hypot(
          a.position[0] - b.position[0],
          a.position[1] - b.position[1],
          a.position[2] - b.position[2],
        );
        const aRadius = (a.properties.radius as number) ?? 1;
        const bRadius = (b.properties.radius as number) ?? 1;
        if (distance < aRadius + bRadius) {
          pairs.push({ entityA: a, entityB: b, penetration: aRadius + bRadius - distance, distance });
        }
      }
    }
    return pairs;
  }

  private resolveCollisions(collisions: CollisionPair[]): void {
    for (const col of collisions) {
      const { entityA: a, entityB: b, penetration, distance } = col;
      if (distance === 0) continue;
      // Normal from A to B
      const normal: [number, number, number] = [
        (b.position[0] - a.position[0]) / distance,
        (b.position[1] - a.position[1]) / distance,
        (b.position[2] - a.position[2]) / distance,
      ];

      // Position correction (separate overlapping entities)
      const massA = (a.properties.mass as number) ?? 1;
      const massB = (b.properties.mass as number) ?? 1;
      const totalMass = massA + massB;
      const aCorrection = (massB / totalMass) * penetration;
      const bCorrection = (massA / totalMass) * penetration;

      if (!a.properties.static) {
        a.position[0] -= normal[0] * aCorrection;
        a.position[1] -= normal[1] * aCorrection;
        a.position[2] -= normal[2] * aCorrection;
      }
      if (!b.properties.static) {
        b.position[0] += normal[0] * bCorrection;
        b.position[1] += normal[1] * bCorrection;
        b.position[2] += normal[2] * bCorrection;
      }

      // Simple impulse-based velocity response (elastic collision coefficient)
      const restitution = 0.8;
      const velA = (a.properties.velocity as [number, number, number]) ?? [0, 0, 0];
      const velB = (b.properties.velocity as [number, number, number]) ?? [0, 0, 0];
      const relVel: [number, number, number] = [
        velA[0] - velB[0],
        velA[1] - velB[1],
        velA[2] - velB[2],
      ];
      const relVelDotNormal = relVel[0] * normal[0] + relVel[1] * normal[1] + relVel[2] * normal[2];
      if (relVelDotNormal <= 0) continue; // separating

      const impulse = (-(1 + restitution) * relVelDotNormal) / totalMass;
      if (!a.properties.static) {
        (a.properties.velocity as [number, number, number])[0] += (impulse * massB) * normal[0];
        (a.properties.velocity as [number, number, number])[1] += (impulse * massB) * normal[1];
        (a.properties.velocity as [number, number, number])[2] += (impulse * massB) * normal[2];
      }
      if (!b.properties.static) {
        (b.properties.velocity as [number, number, number])[0] -= (impulse * massA) * normal[0];
        (b.properties.velocity as [number, number, number])[1] -= (impulse * massA) * normal[1];
        (b.properties.velocity as [number, number, number])[2] -= (impulse * massA) * normal[2];
      }

      this.eventBus.publish('physics.collision.occurred', {
        entityA: a.id,
        entityB: b.id,
        penetration,
      });
    }
  }

  private enforceConstraints(): void {
    for (const constraint of this.constraintRegistry.values()) {
      constraint.enforce(this.entities);
    }
  }

  private rebuildSpatialHash(): void {
    this.spatialHash.clear();
    const CELL_SIZE = 5; // meters
    for (const [id, entity] of this.entities) {
      const key = this.getCellKey(entity.position);
      if (!this.spatialHash.has(key)) {
        this.spatialHash.set(key, []);
      }
      this.spatialHash.get(key)!.push(id);
    }
  }

  private getCellKey(pos: [number, number, number]): string {
    const CELL = 5;
    return `${Math.floor(pos[0] / CELL)},${Math.floor(pos[1] / CELL)},${Math.floor(pos[2] / CELL)}`;
  }

  async addPhysicsEntity(
    type: string,
    position: [number, number, number],
    options?: Partial<PhysicsEntityOptions>,
  ): Promise<WorldEntity> {
    const entity: WorldEntity = {
      id: uuidv4() as WorldEntityId,
      type,
      position,
      rotation: [0, 0, 0, 1],
      properties: {
        mass: options?.mass ?? 1,
        velocity: options?.velocity ?? [0, 0, 0],
        force: [0, 0, 0],
        radius: options?.radius ?? 0.5,
        static: options?.static ?? false,
        affectedByGravity: options?.affectedByGravity ?? true,
        charge: options?.charge ?? 0,
        color: options?.color ?? [200, 200, 200],
      },
      instrumentBindings: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.addEntity(entity);
    return entity;
  }

  addConstraint(constraint: PhysicsConstraint): void {
    this.constraintRegistry.set(constraint.id, constraint);
  }

  removeConstraint(constraintId: string): void {
    this.constraintRegistry.delete(constraintId);
  }

  async saveState(userId: string): Promise<WorldSaveState> {
    const state: WorldSaveState = {
      worldId: this.descriptor.id,
      userId,
      timestamp: Date.now(),
      entities: Array.from(this.entities.values()),
      instrumentBindings: Array.from(this.bindings.values()),
      simulationSnapshot: { constraints: Array.from(this.constraintRegistry.entries()) },
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
    this.constraintRegistry.clear();
    for (const entity of state.entities) {
      this.entities.set(entity.id, entity);
    }
    for (const binding of state.instrumentBindings) {
      this.bindings.set(binding.id, binding);
    }
    if (state.simulationSnapshot && (state.simulationSnapshot as any).constraints) {
      for (const [id, constraint] of (state.simulationSnapshot as any).constraints) {
        this.constraintRegistry.set(id, constraint);
      }
    }
    this.rebuildSpatialHash();
    this.logger.info(`Physics world state restored (${state.entities.length} entities, ${this.constraintRegistry.size} constraints)`);
  }
}

// Supporting types
interface CollisionPair {
  entityA: WorldEntity;
  entityB: WorldEntity;
  penetration: number;
  distance: number;
}

interface PhysicsEntityOptions {
  mass: number;
  velocity: [number, number, number];
  radius: number;
  static: boolean;
  affectedByGravity: boolean;
  charge: number;
  color: [number, number, number];
}

interface PhysicsConstraint {
  id: string;
  type: 'spring' | 'rod' | 'pivot' | 'slider';
  entityA: WorldEntityId;
  entityB: WorldEntityId;
  properties: Record<string, number>;
  enforce: (entities: Map<WorldEntityId, WorldEntity>) => void;
}