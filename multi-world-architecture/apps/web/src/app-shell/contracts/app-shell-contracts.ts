// apps/web/src/app-shell/contracts/app-shell-contracts.ts
/**
 * App Shell Contracts
 * 
 * Responsibilities:
 * - Define types for app shell bootstrap phases, session hydration, world init,
 *   recovery, and AI overlay bootstrapping
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

export type BootstrapPhaseId = string & { readonly __brand: 'BootstrapPhaseId' };

export enum BootstrapPhaseStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface BootstrapPhase {
  id: BootstrapPhaseId;
  name: string;
  priority: number;
  dependsOn: BootstrapPhaseId[];
  timeoutMs: number;
  retryCount: number;
  execute: () => Promise<void>;
}

export interface BootstrapProgress {
  currentPhase: string;
  completedPhases: number;
  totalPhases: number;
  percentage: number;
  lastError?: string;
}

export interface SessionHydrationState {
  userId: string;
  sessionId: string;
  token: string;
  permissions: string[];
  lastWorldId?: string;
  lastExperimentId?: string;
  preferences: Record<string, unknown>;
  validUntil: number;
}

export interface WorldBootstrapContext {
  worldId: string;
  userId: string;
  sessionId: string;
  restoreFromCheckpoint: boolean;
  initialInstruments: string[];
}

export interface AppShellState {
  bootstrapped: boolean;
  sessionReady: boolean;
  worldReady: boolean;
  activeWorldId?: string;
  activeExperimentId?: string;
  uiState: 'loading' | 'active' | 'error' | 'offline';
  globalError?: string;
}

export interface RecoveryCheckpoint {
  appState: AppShellState;
  session?: SessionHydrationState;
  timestamp: number;
  checksum: string;
}

export interface AIOverlayConfig {
  enabled: boolean;
  streamingEnabled: boolean;
  suggestActions: boolean;
  voiceEnabled: boolean;
  position: 'top' | 'bottom' | 'floating';
  maxVisibleMessages: number;
}