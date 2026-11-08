// worlds/contracts/scientific-world-contracts.ts
/**
 * Scientific World Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for domain worlds: chemistry, physics, biology, electronics, mathematics
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

export type WorldEntityId = string & { readonly __brand: 'WorldEntityId' };
export type DomainWorldId = string & { readonly __brand: 'DomainWorldId' };
export type InstrumentBindingId = string & { readonly __brand: 'InstrumentBindingId' };
export type MissionId = string;

export enum Domain {
  CHEMISTRY = 'chemistry',
  PHYSICS = 'physics',
  BIOLOGY = 'biology',
  ELECTRONICS = 'electronics',
  MATHEMATICS = 'mathematics',
}

export interface DomainWorldDescriptor {
  id: DomainWorldId;
  domain: Domain;
  version: string;
  name: string;
  requiredInstruments: string[];
  defaultMissionIds: MissionId[];
  maxEntities: number;
  persistent: boolean;
  simulationConfig: DomainSimulationConfig;
}

export interface DomainSimulationConfig {
  tickRateHz: number;
  solverType: 'ode' | 'molecular' | 'circuit' | 'statistical';
  gpuAcceleration: boolean;
  maxSubSteps: number;
}

export interface WorldEntity {
  id: WorldEntityId;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  properties: Record<string, unknown>;
  instrumentBindings: InstrumentBindingId[];
  createdAt: number;
  updatedAt: number;
}

export interface InstrumentBinding {
  id: InstrumentBindingId;
  worldEntityId: WorldEntityId;
  instrumentId: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  properties: Record<string, unknown>;
}

export interface WorldSaveState {
  worldId: DomainWorldId;
  userId: string;
  timestamp: number;
  entities: WorldEntity[];
  instrumentBindings: InstrumentBinding[];
  simulationSnapshot: unknown;
  missionProgress: Record<MissionId, unknown>;
  checksum: string;
}