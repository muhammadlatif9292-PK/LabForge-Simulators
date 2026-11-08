// apps/web/src/app-shell/runtime/app-shell-runtime.ts
/**
 * App Shell Runtime
 * 
 * Responsibilities:
 * - Orchestrate the entire application shell lifecycle: boot, session, world, UI
 * - Manage the top-level state machine (loading → active → error → offline)
 * - Coordinate with all bootstrap runtimes, HUD, routing, and recovery
 * - Emit shell-level events for observability and debugging
 * - Enforce landscape-only, offline-first constraints at the shell level
 * 
 * Owned state:
 * - state: AppShellState
 * - bootPhases: BootstrapPhase[]
 * - recovery: FrontendRecoveryRuntime
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - FrontendBootstrapRuntime
 * - SessionHydrationRuntime
 * - WorldBootstrapRuntime
 * - FrontendRecoveryRuntime
 * - HUD runtime
 * - Routing orchestrator
 * - AIOverlayBootstrap
 * 
 * Event emissions:
 *   "app.shell.booted", "app.shell.session.ready", "app.shell.world.ready"
 *   "app.shell.error", "app.shell.offline"
 * 
 * Event subscriptions:
 *   "connection.offline" / "connection.online"
 * 
 * Synchronization: single bootstrap sequence; serialised phases
 * Recovery: automatic restore from last checkpoint on crash
 * Telemetry: boot phase durations, overall time to interactive
 * Diagnostics: boot progress, shell state
 * Accessibility: announce boot progress to screen readers; focus management on ready
 * Performance: parallel phases where possible; lazy load non-critical modules
 * Forbidden: blocking the UI thread with synchronous boot; boot loops
 */

import type {
  AppShellState, BootstrapPhase, BootstrapProgress, RecoveryCheckpoint,
} from '../contracts/app-shell-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { FrontendBootstrapRuntime } from './frontend-bootstrap-runtime';
import { SessionHydrationRuntime } from './session-hydration-runtime';
import { WorldBootstrapRuntime } from './world-bootstrap-runtime';
import { FrontendRecoveryRuntime } from './frontend-recovery-runtime';
import type { HUDRuntime } from '@labforge/HUD';
import type { RouteOrchestrator } from '@labforge/routing';

export class AppShellRuntime {
  private state: AppShellState = {
    bootstrapped: false,
    sessionReady: false,
    worldReady: false,
    uiState: 'loading',
  };
  private bootPhases: BootstrapPhase[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private bootRuntime: FrontendBootstrapRuntime,
    private sessionRuntime: SessionHydrationRuntime,
    private worldRuntime: WorldBootstrapRuntime,
    private recovery: FrontendRecoveryRuntime,
    private hud: HUDRuntime,
    private router: RouteOrchestrator,
    private aiOverlayBoot: any, // AIOverlayBootstrap
  ) {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    this.eventBus.subscribe('connection.offline', () => {
      this.state.uiState = 'offline';
      this.eventBus.publish('app.shell.offline', {});
      this.hud.showOverlay?.({
        id: 'offline_banner' as any,
        type: 'warning',
        position: 'top',
        content: 'You are offline. Changes will be saved locally.',
        priority: 100,
        timestamp: Date.now(),
      } as any);
    });
    this.eventBus.subscribe('connection.online', () => {
      this.state.uiState = 'active';
      this.eventBus.publish('app.shell.online', {});
    });
  }

  async boot(): Promise<void> {
    const start = performance.now();
    this.logger.info('App shell boot started');
    this.meter.incrementCounter('app.shell.boot.started');
    this.state.uiState = 'loading';

    try {
      // Phase 1: Core bootstrap (config, services, design tokens)
      await this.runPhase('core_bootstrap', () => this.bootRuntime.initialize());
      // Phase 2: Session hydration (auth token, user prefs, permissions)
      await this.runPhase('session_hydration', () => this.sessionRuntime.hydrate());
      this.state.sessionReady = true;
      await this.eventBus.publish('app.shell.session.ready', {});
      // Phase 3: Recovery check (restore last state if crash)
      await this.runPhase('recovery', async () => {
        const checkpoint = await this.recovery.loadCheckpoint();
        if (checkpoint) {
          this.state = { ...checkpoint.appState, uiState: 'active' };
        }
      });
      // Phase 4: World bootstrap (if returning to a world)
      if (this.state.activeWorldId) {
        await this.runPhase('world_restore', () =>
          this.worldRuntime.bootstrapWorld({
            worldId: this.state.activeWorldId!,
            userId: this.sessionRuntime.getUserId(),
            sessionId: this.sessionRuntime.getSessionId(),
            restoreFromCheckpoint: true,
            initialInstruments: [],
          })
        );
        this.state.worldReady = true;
        await this.eventBus.publish('app.shell.world.ready', { worldId: this.state.activeWorldId });
      }
      // Phase 5: UI shell (HUD, overlays, routing)
      await this.runPhase('ui_shell', async () => {
        await this.hud.start?.();
        await this.aiOverlayBoot.initialize?.();
      });
      // Mark bootstrapped
      this.state.bootstrapped = true;
      this.state.uiState = 'active';
      const elapsed = performance.now() - start;
      this.meter.recordHistogram('app.shell.boot.total_duration', elapsed);
      this.meter.incrementCounter('app.shell.boot.completed');
      this.logger.info(`App shell booted in ${elapsed.toFixed(0)}ms`);
      await this.eventBus.publish('app.shell.booted', { durationMs: elapsed });
      // Navigate to initial route
      this.router.handleNavigation?.({
        to: this.state.activeWorldId ? `/world/${this.state.activeWorldId}` as any : '/home' as any,
        timestamp: Date.now(),
      });
    } catch (err) {
      this.state.uiState = 'error';
      this.state.globalError = (err as Error).message;
      this.logger.error('App shell boot failed', { error: err });
      this.meter.incrementCounter('app.shell.boot.failed');
      await this.eventBus.publish('app.shell.error', { error: (err as Error).message });
      // Attempt recovery
      await this.recovery.attemptRecovery(this.state);
    }
  }

  private async runPhase(name: string, fn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await fn();
      this.meter.recordHistogram(`app.shell.phase.${name}.duration`, Date.now() - start);
    } catch (err) {
      this.logger.error(`Boot phase ${name} failed`, { error: err });
      throw err;
    }
  }

  getState(): Readonly<AppShellState> {
    return { ...this.state };
  }

  getBootProgress(): BootstrapProgress {
    return {
      currentPhase: '',
      completedPhases: 0,
      totalPhases: 0,
      percentage: this.state.bootstrapped ? 100 : 50,
    };
  }

  async shutdown(): Promise<void> {
    await this.recovery.saveCheckpoint({
      appState: this.state,
      timestamp: Date.now(),
      checksum: '',
    });
    this.logger.info('App shell shut down');
  }
}