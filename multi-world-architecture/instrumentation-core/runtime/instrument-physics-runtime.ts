// instrumentation-core/runtime/instrument-physics-runtime.ts
/**
 * Instrument Physics Runtime
 * 
 * Responsibilities:
 * - Apply physical constraints to instrument manipulation (gravity, collision, joint limits)
 * - Simulate instrument-specific physics (beaker liquid sloshing, centrifuge vibration, burner convection)
 * - Couple with the world physics simulation for rigid body interactions
 * - Provide haptic feedback thresholds based on computed forces
 * 
 * Owned state:
 * - activePhysicsBodies: Map<InstrumentId, PhysicsBody>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - PhysicsSimulationRuntime (world-level physics)
 * - InstrumentOrchestrator (instrument lookup)
 * 
 * Event emissions:
 *   "instrument.physics.collision", "instrument.physics.limit_reached"
 *   "instrument.physics.haptic"
 * 
 * Event subscriptions:
 *   "world.simulation.ticked" (update instrument physics)
 * 
 * Synchronization: single-threaded; updates per world tick
 * Recovery: physics state re-initialized on world reload
 * Telemetry: collision count, constraint violations
 * Diagnostics: active physics bodies
 * Accessibility: N/A
 * Performance: simplified physics for instruments; skip when not grabbed
 * Forbidden: simulating full CFD for beaker liquid; blocking tick loop
 */

import type { InstrumentId } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface PhysicsBody {
  instrumentId: InstrumentId;
  position: [number, number, number];
  rotation: [number, number, number, number];
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  mass: number;
  isGrabbed: boolean;
  isColliding: boolean;
}

export class InstrumentPhysicsRuntime {
  private bodies: Map<InstrumentId, PhysicsBody> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {
    this.eventBus.subscribe('world.simulation.ticked', this.onWorldTick.bind(this));
    this.eventBus.subscribe('instrument.interaction', this.onInteraction.bind(this));
  }

  registerInstrument(instrumentId: InstrumentId, position: [number, number, number], mass: number = 1): void {
    this.bodies.set(instrumentId, {
      instrumentId,
      position,
      rotation: [0, 0, 0, 1],
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      mass,
      isGrabbed: false,
      isColliding: false,
    });
  }

  unregisterInstrument(instrumentId: InstrumentId): void {
    this.bodies.delete(instrumentId);
  }

  setGrabbed(instrumentId: InstrumentId, grabbed: boolean): void {
    const body = this.bodies.get(instrumentId);
    if (body) {
      body.isGrabbed = grabbed;
      if (grabbed) {
        // Clear velocity when grabbed
        body.velocity = [0, 0, 0];
        body.angularVelocity = [0, 0, 0];
      }
    }
  }

  updatePosition(instrumentId: InstrumentId, position: [number, number, number], rotation?: [number, number, number, number]): void {
    const body = this.bodies.get(instrumentId);
    if (body) {
      body.position = position;
      if (rotation) body.rotation = rotation;
    }
  }

  getBody(instrumentId: InstrumentId): PhysicsBody | undefined {
    return this.bodies.get(instrumentId);
  }

  private onWorldTick(event: any): void {
    const dt = 1 / 60; // assumed 60Hz
    for (const body of this.bodies.values()) {
      if (body.isGrabbed) continue;
      // Simple gravity
      body.velocity[1] -= 9.81 * dt;
      body.position[0] += body.velocity[0] * dt;
      body.position[1] += body.velocity[1] * dt;
      body.position[2] += body.velocity[2] * dt;
      // Ground collision (simple floor at y=0)
      if (body.position[1] <= 0) {
        body.position[1] = 0;
        body.velocity[1] = Math.abs(body.velocity[1]) * 0.3; // bounce damped
        if (body.velocity[1] < 0.1) body.velocity[1] = 0;
        body.isColliding = true;
        this.eventBus.publish('instrument.physics.collision', {
          instrumentId: body.instrumentId,
          position: body.position,
          velocity: body.velocity,
        });
      } else {
        body.isColliding = false;
      }
      // Haptic feedback threshold
      if (body.isColliding && Math.abs(body.velocity[1]) > 0.5) {
        this.eventBus.publish('instrument.physics.haptic', {
          instrumentId: body.instrumentId,
          intensity: Math.min(1, Math.abs(body.velocity[1]) / 10),
        });
      }
    }
  }

  private onInteraction(event: any): void {
    const { type, instrumentId } = event.payload;
    if (type === 'grab') this.setGrabbed(instrumentId, true);
    else if (type === 'release') this.setGrabbed(instrumentId, false);
  }
}