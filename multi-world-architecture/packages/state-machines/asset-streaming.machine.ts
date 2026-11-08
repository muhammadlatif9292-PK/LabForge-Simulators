// packages/state-machines/asset-streaming.machine.ts
/**
 * Asset Streaming State Machine
 * 
 * Responsibilities:
 * - Formalise the lifecycle of a single asset download
 * - States: queued → downloading → (complete | failed | corrupt)
 * - Track download progress and retry attempts
 * - Validate integrity and transition to corruption handling
 * 
 * Owned state: currentState, bytesDownloaded, retryCount
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum AssetStreamState {
  QUEUED = 'queued',
  DOWNLOADING = 'downloading',
  PAUSED = 'paused',
  VERIFYING = 'verifying',
  COMPLETE = 'complete',
  CORRUPT = 'corrupt',
  FAILED = 'failed',
}

export enum AssetStreamEvent {
  DOWNLOAD_STARTED = 'download_started',
  PROGRESS = 'progress',
  DOWNLOAD_COMPLETE = 'download_complete',
  PAUSE = 'pause',
  RESUME = 'resume',
  VERIFICATION_FAILED = 'verification_failed',
  VERIFICATION_PASSED = 'verification_passed',
  RETRY = 'retry',
  MAX_RETRIES_EXCEEDED = 'max_retries_exceeded',
}

export class AssetStreamingMachine {
  private state: AssetStreamState = AssetStreamState.QUEUED;
  private bytesDownloaded = 0;
  private retryCount = 0;
  private readonly maxRetries = 3;

  private static readonly TRANSITIONS: Array<{ from: AssetStreamState; to: AssetStreamState; event: AssetStreamEvent }> = [
    { from: AssetStreamState.QUEUED, to: AssetStreamState.DOWNLOADING, event: AssetStreamEvent.DOWNLOAD_STARTED },
    { from: AssetStreamState.DOWNLOADING, to: AssetStreamState.DOWNLOADING, event: AssetStreamEvent.PROGRESS },
    { from: AssetStreamState.DOWNLOADING, to: AssetStreamState.PAUSED, event: AssetStreamEvent.PAUSE },
    { from: AssetStreamState.PAUSED, to: AssetStreamState.DOWNLOADING, event: AssetStreamEvent.RESUME },
    { from: AssetStreamState.DOWNLOADING, to: AssetStreamState.VERIFYING, event: AssetStreamEvent.DOWNLOAD_COMPLETE },
    { from: AssetStreamState.VERIFYING, to: AssetStreamState.COMPLETE, event: AssetStreamEvent.VERIFICATION_PASSED },
    { from: AssetStreamState.VERIFYING, to: AssetStreamState.CORRUPT, event: AssetStreamEvent.VERIFICATION_FAILED },
    { from: AssetStreamState.CORRUPT, to: AssetStreamState.QUEUED, event: AssetStreamEvent.RETRY },
    { from: AssetStreamState.DOWNLOADING, to: AssetStreamState.FAILED, event: AssetStreamEvent.MAX_RETRIES_EXCEEDED },
    { from: AssetStreamState.CORRUPT, to: AssetStreamState.FAILED, event: AssetStreamEvent.MAX_RETRIES_EXCEEDED },
  ];

  constructor(
    private assetId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): AssetStreamState { return this.state; }

  async send(event: AssetStreamEvent): Promise<boolean> {
    const transition = AssetStreamingMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!transition) {
      this.logger.warn(`Asset stream transition rejected: ${this.state} + ${event}`, { assetId: this.assetId });
      return false;
    }
    const oldState = this.state;
    this.state = transition.to;

    if (event === AssetStreamEvent.RETRY) this.retryCount++;
    if (event === AssetStreamEvent.VERIFICATION_PASSED) this.retryCount = 0;

    this.meter.incrementCounter('asset.stream.state.changed', { from: oldState, to: this.state });
    await this.eventBus.publish('asset.stream.state.changed', { assetId: this.assetId, from: oldState, to: this.state, event });

    // Auto-fail if retries exhausted
    if ((this.state === AssetStreamState.CORRUPT || this.state === AssetStreamState.DOWNLOADING) && this.retryCount >= this.maxRetries) {
      await this.send(AssetStreamEvent.MAX_RETRIES_EXCEEDED);
    }

    return true;
  }
}