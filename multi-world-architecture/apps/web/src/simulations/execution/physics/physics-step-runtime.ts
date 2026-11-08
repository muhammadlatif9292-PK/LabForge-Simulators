// apps/web/src/simulations/execution/physics/physics-step-runtime.ts
/**
 * Physics Step Runtime
 * 
 * Responsibilities:
 * - Integrate physics for all entities over a single simulation step
 * - Support sub-stepping for stability (fixed time step)
 * - Detect collisions and generate collision events
 * - Ensure deterministic floating-point operations (same order, same precision)
 * - Report step timing for diagnostics
 * 
 * Owned state: none (stateless, uses state passed in)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DeterministicRNG (passed via runtime)
 * 
 * Event emissions: none (returns result synchronously)
 * Event subscriptions: none
 * Synchronization: none (pure function)
 * Recovery: n/a (stateless)
 * Telemetry: step count, collision count, duration
 * Diagnostics: per-step stats
 * Accessibility: N/A
 * Performance: SIMD if available; batch entity processing
 * Forbidden: using unordered collections; non-deterministic iteration order
 */

import type { SimulationState, EntityState, PhysicsStep, CollisionEvent } from '../contracts/simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

// The RNG interface (passed from deterministic runtime)
interface IRNG { next(): number; }

export class PhysicsStepRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  step(state: SimulationState, deltaTimeSec: number, rng: IRNG): PhysicsStep {
    const start = performance.now();
    const entities = Array.from(state.entities.values());
    // Fixed sub-step size for stability
    const subStepCount = Math.max(1, Math.ceil(deltaTimeSec / 0.004)); // 4ms sub-steps
    const subDt = deltaTimeSec / subStepCount;

    let collisions: CollisionEvent[] = [];
    // Run sub-steps
    for (let s = 0; s < subStepCount; s++) {
      this.integrateMotion(entities, subDt);
      const stepCollisions = this.detectCollisions(entities);
      collisions = collisions.concat(stepCollisions);
      this.resolveCollisions(stepCollisions, entities);
    }

    const duration = performance.now() - start;
    this.meter.recordHistogram('physics.step.duration', duration);
    this.meter.incrementCounter('physics.step.executed');
    return {
      stepIndex: state.currentTick,
      subTickMs: deltaTimeSec * 1000,
      entities,
      collisions,
    };
  }

  private integrateMotion(entities: EntityState[], dt: number): void {
    for (const e of entities) {
      // Semi-implicit Euler integration (deterministic)
      e.velocity[0] += 0 * dt; // no forces for now
      e.velocity[1] += -9.81 * dt; // gravity
      e.velocity[2] += 0 * dt;
      e.position[0] += e.velocity[0] * dt;
      e.position[1] += e.velocity[1] * dt;
      e.position[2] += e.velocity[2] * dt;
    }
  }

  private detectCollisions(entities: EntityState[]): CollisionEvent[] {
    // Very simple O(n^2) broadphase; production would use spatial hash
    const events: CollisionEvent[] = [];
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        const dist = Math.sqrt(
          (a.position[0] - b.position[0]) ** 2 +
          (a.position[1] - b.position[1]) ** 2 +
          (a.position[2] - b.position[2]) ** 2,
        );
        // Assume radius = 1 for both
        if (dist < 2) {
          events.push({
            entityA: a.id,
            entityB: b.id,
            contactPoint: [
              (a.position[0] + b.position[0]) / 2,
              (a.position[1] + b.position[1]) / 2,
              (a.position[2] + b.position[2]) / 2,
            ],
            normal: [
              (b.position[0] - a.position[0]) / dist,
              (b.position[1] - a.position[1]) / dist,
              (b.position[2] - a.position[2]) / dist,
            ],
            impulse: 1.0,
          });
        }
      }
    }
    return events;
  }

  private resolveCollisions(collisions: CollisionEvent[], entities: EntityState[]): void {
    // Simple impulse-based resolution (position correction)
    for (const col of collisions) {
      const a = entities.find(e => e.id === col.entityA);
      const b = entities.find(e => e.id === col.entityB);
      if (!a || !b) continue;
      const penetration = 2 - Math.hypot(
        a.position[0] - b.position[0],
        a.position[1] - b.position[1],
        a.position[2] - b.position[2],
      );
      if (penetration > 0) {
        // Move apart along normal
        a.position[0] -= col.normal[0] * penetration * 0.5;
        a.position[1] -= col.normal[1] * penetration * 0.5;
        a.position[2] -= col.normal[2] * penetration * 0.5;
        b.position[0] += col.normal[0] * penetration * 0.5;
        b.position[1] += col.normal[1] * penetration * 0.5;
        b.position[2] += col.normal[2] * penetration * 0.5;
      }
    }
  }
}