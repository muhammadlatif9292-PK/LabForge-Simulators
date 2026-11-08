// apps/web/src/simulations/execution/contracts/simulation-contracts.ts
/**
 * Simulation Execution Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for deterministic simulation execution
 * - Provide types for ticks, physics steps, checkpoints, and replay
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type SimulationId = string & { readonly __brand: 'SimulationId' };
export type TickNumber = number & { readonly __brand: 'TickNumber' };
export type StateHash = string & { readonly __brand: 'StateHash' };
export type CheckpointId = string & { readonly __brand: 'CheckpointId' };
export type EntityId = string & { readonly __brand: 'EntityId' };

export interface SimulationState {
  simulationId: SimulationId;
  currentTick: TickNumber;
  stateHash: StateHash;
  entities: Map<EntityId, EntityState>;
  timestamp: number;
  deterministicSeed: number;
}

export interface EntityState {
  id: EntityId;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  properties: Record<string, unknown>;
}

export interface TickInput {
  tickNumber: TickNumber;
  deltaTimeMs: number;
  userInputs: UserInput[];
  externalEvents: SimulationEvent[];
}

export interface TickOutput {
  tickNumber: TickNumber;
  applied: boolean;
  newState: SimulationState;
  stateHash: StateHash;
  events: SimulationEvent[];
  durationMs: number;
}

export interface UserInput {
  entityId: EntityId;
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface SimulationEvent {
  id: string;
  type: string;
  payload: unknown;
  tick: TickNumber;
  timestamp: number;
}

export interface PhysicsStep {
  stepIndex: number;
  subTickMs: number;
  entities: EntityState[];
  collisions: CollisionEvent[];
}

export interface CollisionEvent {
  entityA: EntityId;
  entityB: EntityId;
  contactPoint: [number, number, number];
  normal: [number, number, number];
  impulse: number;
}

export interface Checkpoint {
  id: CheckpointId;
  simulationId: SimulationId;
  tick: TickNumber;
  state: SimulationState;
  createdAt: number;
  sizeBytes: number;
  valid: boolean;
}

export interface ReplayFrame {
  tick: TickNumber;
  state: SimulationState;
  inputs: TickInput;
  output: TickOutput;
}

export interface ConsistencyReport {
  consistent: boolean;
  mismatchTick?: TickNumber;
  expectedHash: StateHash;
  actualHash: StateHash;
  divergentEntities: EntityId[];
}