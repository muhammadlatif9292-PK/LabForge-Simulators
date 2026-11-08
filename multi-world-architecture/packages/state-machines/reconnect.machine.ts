// packages/state-machines/reconnect.machine.ts
/**
 * Reconnect State Machine
 * 
 * Responsibilities:
 * - Formalise the reconnection lifecycle after network loss
 * - States: connected → disconnected → reconnecting → (connected | failed)
 * - Implement exponential backoff with jitter
 * - Track retry count and maximum retry limit
 * 
 * Owned state: currentState, retryCount, backoffMs
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum ReconnectState {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

export enum ReconnectEvent {
  CONNECTION_LOST = 'connection_lost',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  RECONNECT_SUCCEEDED = 'reconnect_succeeded',
  RECONNECT_FAILED = 'reconnect_failed',
  MAX_RETRIES_EXCEEDED = 'max_retries_exceeded',
  MANUAL_RECONNECT = 'manual_reconnect',
}

export class ReconnectMachine {
  private state: ReconnectState = ReconnectState.CONNECTED;
  private retryCount = 0;
  private backoffMs = 0;
  private readonly baseBackoffMs = 1000;
  private readonly maxBackoffMs = 30000;
  private readonly maxRetries = 10;

  private static readonly TRANSITIONS: Array<{ from: ReconnectState; to: ReconnectState; event: ReconnectEvent }> = [
    { from: ReconnectState.CONNECTED, to: ReconnectState.DISCONNECTED, event: ReconnectEvent.CONNECTION_LOST },
    { from: ReconnectState.DISCONNECTED, to: ReconnectState.RECONNECTING, event: ReconnectEvent.RECONNECT_ATTEMPT },
    { from: ReconnectState.RECONNECTING, to: ReconnectState.CONNECTED, event: ReconnectEvent.RECONNECT_SUCCEEDED },
    { from: ReconnectState.RECONNECTING, to: ReconnectState.DISCONNECTED, event: ReconnectEvent.RECONNECT_FAILED },
    { from: ReconnectState.DISCONNECTED, to: ReconnectState.FAILED, event: ReconnectEvent.MAX_RETRIES_EXCEEDED },
    { from: ReconnectState.FAILED, to: ReconnectState.RECONNECTING, event: ReconnectEvent.MANUAL_RECONNECT },
  ];

  constructor(
    private connectionId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): ReconnectState { return this.state; }
  getRetryCount(): number { return this.retryCount; }
  getBackoffMs(): number { return this.backoffMs; }

  async send(event: ReconnectEvent): Promise<boolean> {
    const transition = ReconnectMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!transition) {
      this.logger.warn(`Reconnect transition rejected: ${this.state} + ${event}`);
      return false;
    }

    const oldState = this.state;
    this.state = transition.to;

    if (event === ReconnectEvent.RECONNECT_ATTEMPT) {
      this.retryCount++;
      this.backoffMs = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, this.retryCount - 1));
    }
    if (event === ReconnectEvent.RECONNECT_SUCCEEDED) {
      this.retryCount = 0;
      this.backoffMs = 0;
    }

    this.meter.incrementCounter('reconnect.state.changed', { from: oldState, to: this.state });
    this.logger.info(`Reconnect: ${oldState} → ${this.state} (retry ${this.retryCount})`, { connectionId: this.connectionId });
    await this.eventBus.publish('reconnect.state.changed', {
      connectionId: this.connectionId,
      from: oldState,
      to: this.state,
      retryCount: this.retryCount,
      backoffMs: this.backoffMs,
    });

    // Auto-trigger next attempt if reconnecting failed and not at max
    if (this.state === ReconnectState.DISCONNECTED && event === ReconnectEvent.RECONNECT_FAILED && this.retryCount < this.maxRetries) {
      setTimeout(() => this.send(ReconnectEvent.RECONNECT_ATTEMPT), this.backoffMs);
    }
    if (this.state === ReconnectState.DISCONNECTED && this.retryCount >= this.maxRetries) {
      await this.send(ReconnectEvent.MAX_RETRIES_EXCEEDED);
    }

    return true;
  }
}