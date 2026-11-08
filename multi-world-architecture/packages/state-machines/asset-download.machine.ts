// packages/state-machines/asset-download.machine.ts
/**
 * Asset Download State Machine
 * 
 * Responsibilities:
 * - Per-asset download lifecycle: queued → downloading → verifying → complete | corrupt → retrying → failed
 * - Track retries and enforce max attempts
 * 
 * Owned state: currentState, retryCount
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum AssetDownloadState {
  QUEUED = 'queued',
  DOWNLOADING = 'downloading',
  PAUSED = 'paused',
  VERIFYING = 'verifying',
  COMPLETE = 'complete',
  CORRUPT = 'corrupt',
  RETRYING = 'retrying',
  FAILED = 'failed',
}

export enum AssetDownloadEvent {
  START = 'start',
  PROGRESS = 'progress',
  PAUSE = 'pause',
  RESUME = 'resume',
  COMPLETE = 'complete',
  VERIFY_FAIL = 'verify_fail',
  RETRY = 'retry',
  MAX_RETRIES = 'max_retries',
}

export class AssetDownloadMachine {
  private state: AssetDownloadState = AssetDownloadState.QUEUED;
  private retryCount = 0;
  private readonly maxRetries = 3;

  private static readonly TRANSITIONS: Record<string, AssetDownloadState> = {
    [`${AssetDownloadState.QUEUED}.${AssetDownloadEvent.START}`]: AssetDownloadState.DOWNLOADING,
    [`${AssetDownloadState.DOWNLOADING}.${AssetDownloadEvent.PROGRESS}`]: AssetDownloadState.DOWNLOADING,
    [`${AssetDownloadState.DOWNLOADING}.${AssetDownloadEvent.PAUSE}`]: AssetDownloadState.PAUSED,
    [`${AssetDownloadState.PAUSED}.${AssetDownloadEvent.RESUME}`]: AssetDownloadState.DOWNLOADING,
    [`${AssetDownloadState.DOWNLOADING}.${AssetDownloadEvent.COMPLETE}`]: AssetDownloadState.VERIFYING,
    [`${AssetDownloadState.VERIFYING}.${AssetDownloadEvent.VERIFY_FAIL}`]: AssetDownloadState.CORRUPT,
    [`${AssetDownloadState.VERIFYING}.${AssetDownloadEvent.COMPLETE}`]: AssetDownloadState.COMPLETE,
    [`${AssetDownloadState.CORRUPT}.${AssetDownloadEvent.RETRY}`]: AssetDownloadState.RETRYING,
    [`${AssetDownloadState.RETRYING}.${AssetDownloadEvent.START}`]: AssetDownloadState.DOWNLOADING,
    [`${AssetDownloadState.CORRUPT}.${AssetDownloadEvent.MAX_RETRIES}`]: AssetDownloadState.FAILED,
  };

  constructor(
    private assetId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): AssetDownloadState { return this.state; }

  async send(event: AssetDownloadEvent): Promise<boolean> {
    const key = `${this.state}.${event}`;
    const target = AssetDownloadMachine.TRANSITIONS[key];
    if (!target) {
      this.logger.warn(`Asset download transition rejected: ${this.state} + ${event}`);
      return false;
    }
    this.state = target;
    if (event === AssetDownloadEvent.RETRY) {
      this.retryCount++;
      if (this.retryCount >= this.maxRetries) {
        this.state = AssetDownloadState.FAILED;
        await this.eventBus.publish('asset.download.max_retries', { assetId: this.assetId });
      }
    }
    if (event === AssetDownloadEvent.COMPLETE && this.state === AssetDownloadState.COMPLETE) {
      this.retryCount = 0;
    }
    return true;
  }
}