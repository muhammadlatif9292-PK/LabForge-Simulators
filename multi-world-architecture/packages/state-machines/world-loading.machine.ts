// packages/state-machines/world-loading.machine.ts
/**
 * World Loading State Machine
 * 
 * Responsibilities:
 * - Formalise the world loading/unloading lifecycle
 * - States: unloaded → loading_manifest → streaming_assets → initializing_simulation → ready
 * - Support suspend/resume for memory pressure
 * - Detect loading failures and escalate to recovery
 * 
 * Owned state: currentState, loadedAssetCount
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum WorldLoadState {
  UNLOADED = 'unloaded',
  LOADING_MANIFEST = 'loading_manifest',
  STREAMING_ASSETS = 'streaming_assets',
  INITIALIZING_SIMULATION = 'initializing_simulation',
  READY = 'ready',
  SUSPENDED = 'suspended',
  UNLOADING = 'unloading',
  ERROR = 'error',
}

export enum WorldLoadEvent {
  LOAD_REQUESTED = 'load_requested',
  MANIFEST_LOADED = 'manifest_loaded',
  ASSETS_STREAMED = 'assets_streamed',
  SIMULATION_READY = 'simulation_ready',
  SUSPEND = 'suspend',
  RESUME = 'resume',
  UNLOAD = 'unload',
  LOAD_FAILED = 'load_failed',
  RETRY = 'retry',
}

export class WorldLoadingMachine {
  private state: WorldLoadState = WorldLoadState.UNLOADED;
  private loadedAssetCount = 0;

  private static readonly TRANSITIONS: Array<{ from: WorldLoadState; to: WorldLoadState; event: WorldLoadEvent }> = [
    { from: WorldLoadState.UNLOADED, to: WorldLoadState.LOADING_MANIFEST, event: WorldLoadEvent.LOAD_REQUESTED },
    { from: WorldLoadState.LOADING_MANIFEST, to: WorldLoadState.STREAMING_ASSETS, event: WorldLoadEvent.MANIFEST_LOADED },
    { from: WorldLoadState.STREAMING_ASSETS, to: WorldLoadState.INITIALIZING_SIMULATION, event: WorldLoadEvent.ASSETS_STREAMED },
    { from: WorldLoadState.INITIALIZING_SIMULATION, to: WorldLoadState.READY, event: WorldLoadEvent.SIMULATION_READY },
    { from: WorldLoadState.READY, to: WorldLoadState.SUSPENDED, event: WorldLoadEvent.SUSPEND },
    { from: WorldLoadState.SUSPENDED, to: WorldLoadState.READY, event: WorldLoadEvent.RESUME },
    { from: WorldLoadState.READY, to: WorldLoadState.UNLOADING, event: WorldLoadEvent.UNLOAD },
    { from: WorldLoadState.SUSPENDED, to: WorldLoadState.UNLOADING, event: WorldLoadEvent.UNLOAD },
    { from: WorldLoadState.UNLOADING, to: WorldLoadState.UNLOADED, event: WorldLoadEvent.ASSETS_STREAMED },
    { from: WorldLoadState.LOADING_MANIFEST, to: WorldLoadState.ERROR, event: WorldLoadEvent.LOAD_FAILED },
    { from: WorldLoadState.STREAMING_ASSETS, to: WorldLoadState.ERROR, event: WorldLoadEvent.LOAD_FAILED },
    { from: WorldLoadState.INITIALIZING_SIMULATION, to: WorldLoadState.ERROR, event: WorldLoadEvent.LOAD_FAILED },
    { from: WorldLoadState.ERROR, to: WorldLoadState.LOADING_MANIFEST, event: WorldLoadEvent.RETRY },
  ];

  constructor(
    private worldId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): WorldLoadState { return this.state; }

  async send(event: WorldLoadEvent): Promise<boolean> {
    const transition = WorldLoadingMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!transition) {
      this.logger.warn(`World load transition rejected: ${this.state} + ${event}`, { worldId: this.worldId });
      return false;
    }
    const oldState = this.state;
    this.state = transition.to;
    this.meter.incrementCounter('world.load.state.changed', { from: oldState, to: this.state });
    this.logger.info(`World load: ${oldState} → ${this.state}`, { worldId: this.worldId });
    await this.eventBus.publish('world.load.state.changed', { worldId: this.worldId, from: oldState, to: this.state, event });
    return true;
  }

  isLoading(): boolean {
    return [WorldLoadState.LOADING_MANIFEST, WorldLoadState.STREAMING_ASSETS, WorldLoadState.INITIALIZING_SIMULATION].includes(this.state);
  }

  isReady(): boolean { return this.state === WorldLoadState.READY; }
}