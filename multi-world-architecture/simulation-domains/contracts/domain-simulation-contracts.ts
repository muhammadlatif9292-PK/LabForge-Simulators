// simulation-domains/contracts/domain-simulation-contracts.ts
/**
 * Scientific Domain Simulation Contracts
 * 
 * Responsibilities:
 * - Define interfaces for domain-specific scientific simulations
 * - Provide types for solvers, reaction systems, and scientific measurements
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

export type DomainSimulationId = string & { readonly __brand: 'DomainSimulationId' };
export type ReactionId = string & { readonly __brand: 'ReactionId' };
export type SubstanceId = string & { readonly __brand: 'SubstanceId' };
export type SolverId = string & { readonly __brand: 'SolverId' };

export enum SimulationDomain {
  CHEMISTRY = 'chemistry',
  PHYSICS = 'physics',
  BIOLOGY = 'biology',
  ELECTRONICS = 'electronics',
  MATHEMATICS = 'mathematics',
}

export interface DomainSimulationDescriptor {
  id: DomainSimulationId;
  domain: SimulationDomain;
  worldId: string;
  tickRateHz: number;
  solverConfig: SolverConfig;
  initialSubstances?: SubstanceState[];
  maxEntities: number;
}

export interface SolverConfig {
  solverId: SolverId;
  type: 'ode' | 'pde' | 'molecular' | 'circuit' | 'statistical';
  tolerance: number;
  maxIterations: number;
  adaptiveStep: boolean;
  parameters: Record<string, number>;
}

export interface SubstanceState {
  id: SubstanceId;
  name: string;
  formula: string;
  amount: number;          // moles
  temperature: number;     // Kelvin
  pressure: number;        // atm
  phase: 'solid' | 'liquid' | 'gas' | 'aqueous';
  concentration?: number;  // mol/L for solutions
}

export interface ReactionDefinition {
  id: ReactionId;
  reactants: { substanceId: SubstanceId; coefficient: number }[];
  products: { substanceId: SubstanceId; coefficient: number }[];
  rateConstant: number;
  activationEnergy: number;   // J/mol
  enthalpyChange: number;     // J
  catalyst?: SubstanceId;
  conditions?: { minTemp?: number; maxTemp?: number; minPressure?: number };
}

export interface SimulationSnapshot {
  simulationId: DomainSimulationId;
  tick: number;
  timestamp: number;
  substances: SubstanceState[];
  activeReactions: ReactionId[];
  stateHash: string;
}

export interface DomainValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  conservationCheck: { energy: boolean; mass: boolean; charge?: boolean };
}

export interface ReplayEntry {
  tick: number;
  input?: unknown;
  snapshot: SimulationSnapshot;
  durationMs: number;
}

export interface GPUComputeTask {
  id: string;
  type: 'molecular_dynamics' | 'reaction_kinetics' | 'circuit_solve' | 'statistical_sample';
  inputBuffers: Map<string, Float32Array>;
  expectedDurationMs: number;
}